/**
 * MCP transport adapter for Next.js SSE streams.
 */

import { type Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { type JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { writeDebugLog } from "@/lib/debug-log";

/**
 * Transport adapter that bridges MCP protocol over Next.js SSE streams.
 */
export class NextJsSseTransport implements Transport {
  private _sessionId: string;
  private _controller: ReadableStreamDefaultController | null = null;
  private _messageHandler: ((message: JSONRPCMessage) => void) | undefined;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  /**
   * Creates a transport for a single SSE session.
   */
  constructor(sessionId: string) {
    this._sessionId = sessionId;
  }

  /**
   * Start hook required by the MCP transport interface.
   */
  // eslint-disable-next-line class-methods-use-this
  async start(): Promise<void> {
    await Promise.resolve();
  }

  /**
   * Forwards a JSON-RPC message from the POST handler to the SDK.
   */
  handlePostMessage(message: JSONRPCMessage) {
    this._messageHandler?.(message);
  }

  /**
   * Registers the SDK message handler.
   */
  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._messageHandler = handler;
  }

  /**
   * Returns the registered message handler.
   */
  get onmessage() {
    if (!this._messageHandler) {
      throw new Error("MCP transport message handler is not set.");
    }
    return this._messageHandler;
  }

  /**
   * Sends a JSON-RPC message over the SSE stream.
   */
  async send(message: JSONRPCMessage) {
    if (!this._controller) {
      console.error(
        `[Transport ${this._sessionId}] Error: No stream controller attached. Message dropped.`
      );
      return;
    }

    const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    this._controller.enqueue(new TextEncoder().encode(event));
    await writeDebugLog("mcp.message.out", {
      sessionId: this._sessionId,
      message,
    });
  }

  /**
   * Closes the transport and underlying stream.
   */
  async close() {
    if (this._controller) {
      try {
        this._controller.close();
      } catch (error) {
        console.warn(
          `[Transport ${this._sessionId}] Failed to close controller`,
          error
        );
      }
    }
    this.onclose?.();
    await Promise.resolve();
  }

  /**
   * Attaches the stream controller from the SSE response.
   */
  attachController(controller: ReadableStreamDefaultController) {
    this._controller = controller;
  }
}

/**
 * In-memory store for active SSE transports.
 */
export const activeTransports = new Map<string, NextJsSseTransport>();
