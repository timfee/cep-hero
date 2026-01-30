import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * A custom MCP Transport adapter for Next.js App Router (Server-Sent Events).
 *
 * This class bridges the `@modelcontextprotocol/sdk` (which expects a standard Transport interface)
 * with the Next.js `ReadableStream` based SSE implementation.
 *
 * Flow:
 * 1. `GET /api/mcp` -> Creates `NextJsSseTransport`, starts a `ReadableStream`, and attaches the controller here.
 * 2. `POST /api/mcp` -> Receives JSON-RPC payload, calls `handlePostMessage`.
 * 3. SDK processes message -> Calls `send`.
 * 4. `send` -> Enqueues data into the `ReadableStream` controller, sending it back to client.
 */
export class NextJsSseTransport implements Transport {
  private _sessionId: string;
  private _controller: ReadableStreamDefaultController | null = null;
  private _messageHandler: ((message: JSONRPCMessage) => void) | undefined;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  /**
   * @param sessionId - Unique identifier for this transport session.
   */
  constructor(sessionId: string) {
    this._sessionId = sessionId;
  }

  /**
   * Lifecycle method called by the MCP Server when it starts.
   * In the SSE model, the connection is already "started" by the HTTP request, so this is a no-op.
   */
  async start(): Promise<void> {
    // No-op for SSE
  }

  /**
   * Ingests a JSON-RPC message from an external source (e.g., the POST request body)
   * and passes it to the MCP SDK's registered message handler.
   *
   * @param message - The parsed JSON-RPC message.
   */
  async handlePostMessage(message: JSONRPCMessage) {
    if (this._messageHandler) {
      this._messageHandler(message);
    }
  }

  /**
   * Registers the callback used by the MCP SDK to receive messages from the transport.
   */
  set onmessage(handler: (message: JSONRPCMessage) => void) {
    this._messageHandler = handler;
  }

  get onmessage() {
    return this._messageHandler!;
  }

  /**
   * Sends a JSON-RPC message from the Server to the Client via the SSE stream.
   *
   * @param message - The JSON-RPC message to send.
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._controller) {
      console.error(
        `[Transport ${this._sessionId}] Error: No stream controller attached. Message dropped.`
      );
      return;
    }

    // Format adheres to the Server-Sent Events standard:
    // event: message
    // data: {"jsonrpc": "2.0", ...}
    // \n\n
    const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    this._controller.enqueue(new TextEncoder().encode(event));
  }

  /**
   * Closes the transport and the underlying stream.
   */
  async close(): Promise<void> {
    if (this._controller) {
      try {
        this._controller.close();
      } catch {
        // Controller might already be closed
      }
    }
    this.onclose?.();
  }

  /**
   * Internal method to attach the Next.js `ReadableStreamDefaultController`.
   * This MUST be called inside the `start()` callback of the `ReadableStream` constructor.
   *
   * @param controller - The controller provided by Next.js.
   */
  attachController(controller: ReadableStreamDefaultController) {
    this._controller = controller;
  }
}

/**
 * Global in-memory store for active transports.
 *
 * Note: In a serverless deployment (Vercel), this will NOT persist across different lambda invocations
 * unless the GET (SSE) and POST (RPC) hit the same warm instance.
 * For a prototype running on `bun dev` or a container, this is functional.
 *
 * For production, use Redis to publish/subscribe to channels identified by `sessionId`.
 */
export const activeTransports = new Map<string, NextJsSseTransport>();
