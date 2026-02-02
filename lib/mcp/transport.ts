import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

import { writeDebugLog } from "@/lib/debug-log";

/**
 * Transport adapter for MCP over Next.js SSE streams.
 */
export class NextJsSseTransport implements Transport {
  private _sessionId: string;
  private _controller: ReadableStreamDefaultController | null = null;
  private _messageHandler: ((message: JSONRPCMessage) => void) | undefined;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  /**
   * Create a transport for a single SSE session.
   */
  constructor(sessionId: string) {
    this._sessionId = sessionId;
  }

  /**
   * Start hook required by the MCP transport interface.
   */
  async start(): Promise<void> {}

  /**
   * Forward a JSON-RPC message from the POST handler to the SDK.
   */
  async handlePostMessage(message: JSONRPCMessage) {
    if (this._messageHandler) {
      this._messageHandler(message);
    }
  }

  /**
   * Register the SDK message handler.
   */
  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._messageHandler = handler;
  }

  get onmessage() {
    return this._messageHandler!;
  }

  /**
   * Send a JSON-RPC message over the SSE stream.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._controller) {
      console.error(
        `[Transport ${this._sessionId}] Error: No stream controller attached. Message dropped.`
      );
      return;
    }

    const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    await writeDebugLog("mcp.message.out", {
      sessionId: this._sessionId,
      message,
    });
    this._controller.enqueue(new TextEncoder().encode(event));
  }

  /**
   * Close the transport and underlying stream.
   */
  async close(): Promise<void> {
    if (this._controller) {
      try {
        this._controller.close();
      } catch {}
    }
    this.onclose?.();
  }

  /**
   * Attach the stream controller from the SSE response.
   */
  attachController(controller: ReadableStreamDefaultController) {
    this._controller = controller;
  }
}

/**
 * In-memory store for active SSE transports.
 */
export const activeTransports = new Map<string, NextJsSseTransport>();
