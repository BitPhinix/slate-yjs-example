import cors from "cors";
import express from "express";
import * as http from "http";
import { Node } from "slate";
import * as WebSocket from "ws";
import { WSManager } from "./server";

const defaultValue: Node[] = [
  {
    type: "paragraph",
    children: [
      {
        text: "",
      },
    ],
  },
];

const run = () => {
  const port = process.env.PORT || 9000;

  const app = express().use(cors());
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  const manager = new WSManager({
    loadDocument: () => defaultValue,
  });

  wss.on("connection", (socket, request) => {
    manager.setupWSConnection(socket as any, request);
  });

  server.listen(port);
  console.log(`Listening on ::${port}`);
};

run();
