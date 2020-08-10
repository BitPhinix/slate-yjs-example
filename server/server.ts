import * as http from "http";
import { Node } from "slate";
import { toSyncDoc } from "slate-yjs";
import * as WebSocket from "ws";
import * as Y from "yjs";

const awarenessProtocol = require("y-protocols/dist/awareness.cjs");
const syncProtocol = require("y-protocols/dist/sync.cjs");
const decoding = require("lib0/dist/decoding.cjs");
const encoding = require("lib0/dist/encoding.cjs");

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2;
const wsReadyStateClosed = 3;

const messageSync = 0;
const messageAwareness = 1;
// const messageAuth = 2

export interface WSManagerOptions {
  loadDocument: (name: string) => Node[];
  pingTimeout?: number;
}

export class WSManager {
  readonly loadDocument: (name: string) => Node[];
  readonly pingTimeout: number;
  readonly autoSaveInterval?: number;

  docs: Map<string, WSSharedDoc> = new Map();

  constructor(opts: WSManagerOptions) {
    this.loadDocument = opts.loadDocument;
    this.pingTimeout = opts.pingTimeout ?? 30000;
  }

  setupWSConnection = async (
    conn: WebSocket,
    req: http.IncomingMessage,
    { docName = req.url?.slice(1).split("?")[0] || "", gc = true } = {}
  ) => {
    let doc = this.docs.get(docName);

    // Doc is already loaded => connect it to the socket.
    if (doc === undefined) {
      const content = this.loadDocument(docName);
      doc = new WSSharedDoc({
        name: docName,
        manager: this,
        pingTimeout: this.pingTimeout,
      });
      toSyncDoc(doc.getArray("content"), content);
      this.docs.set(docName, doc);
    }

    doc.connectSocket(conn);
  };
}

export interface WSSharedDocOptions {
  gcEnabled?: boolean;
  gcFilter?: (item: Y.Item) => boolean;
  name: string;
  manager: WSManager;
  pingTimeout: number;
}

export class WSSharedDoc extends Y.Doc {
  readonly name: string;
  readonly conns: Map<WebSocket, Set<number>> = new Map();
  readonly awareness: any;
  readonly manager: WSManager;
  readonly pingTimeout: number;

  constructor(opts: WSSharedDocOptions) {
    super({ gc: opts.gcEnabled ?? true, gcFilter: opts.gcFilter ?? (() => false) });
    this.name = opts.name;
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);
    this.pingTimeout = opts.pingTimeout;
    this.manager = opts.manager;

    const awarenessChangeHandler = (
      {
        added,
        updated,
        removed,
      }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
      conn: WebSocket | null
    ) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => {
            connControlledIDs.add(clientID);
          });
          removed.forEach((clientID) => {
            connControlledIDs.delete(clientID);
          });
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        this.send(c, buff);
      });
    };

    this.awareness.on("update", awarenessChangeHandler);
    this.on("update", this.updateHandler);
  }

  updateHandler = (update: Uint8Array, origin: any) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    this.conns.forEach((_, conn) => this.send(conn, message));
  };

  send = (conn: WebSocket, m: Uint8Array) => {
    if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
      this.closeConn(conn);
    }
    try {
      conn.send(m);
    } catch (e) {
      this.closeConn(conn);
    }
  };

  closeConn = (conn: WebSocket) => {
    if (this.conns.has(conn)) {
      const controlledIds = this.conns.get(conn)!;
      this.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlledIds), null);
    }
    conn.close();
  };

  connectSocket = (conn: WebSocket) => {
    conn.binaryType = "arraybuffer";

    this.conns.set(conn, new Set());

    // listen and reply to events
    conn.on("message", (message) => this.messageListener(conn, new Uint8Array(message as any)));

    conn.on("close", () => {
      this.closeConn(conn);
    });

    // Check if connection is still alive
    let pongReceived = true;
    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        if (this.conns.has(conn)) {
          this.closeConn(conn);
        }
        clearInterval(pingInterval);
      } else if (this.conns.has(conn)) {
        pongReceived = false;
        try {
          conn.ping();
        } catch (e) {
          this.closeConn(conn);
        }
      }
    }, this.pingTimeout);

    conn.on("pong", () => {
      pongReceived = true;
    });

    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, this);
    this.send(conn, encoding.toUint8Array(encoder));
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(awarenessStates.keys()))
      );
      this.send(conn, encoding.toUint8Array(encoder));
    }
  };

  messageListener = (conn: WebSocket, message: Uint8Array) => {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, this, null);
        if (encoding.length(encoder) > 1) {
          this.send(conn, encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          conn
        );
        break;
      }
    }
  };
}
