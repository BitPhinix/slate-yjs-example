import styled from "@emotion/styled";
import React, { useEffect, useMemo, useState } from "react";
import { createEditor, Node } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";
import { SyncElement, toSharedType, withYjs } from "slate-yjs";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { Button, H4, Instance, Title } from "./Components";
import EditorFrame from "./EditorFrame";
import { withLinks } from "./plugins/link";

const WEBSOCKET_ENDPOINT =
  process.env.NODE_ENV === "production"
    ? "wss://demos.yjs.dev/slate-demo"
    : "ws://localhost:1234";

interface ClientProps {
  name: string;
  id: string;
  slug: string;
  removeUser: (id: any) => void;
}

const Client: React.FC<ClientProps> = ({ id, name, slug, removeUser }) => {
  const [value, setValue] = useState<Node[]>([]);
  const [isOnline, setOnlineState] = useState<boolean>(false);

  const [sharedType, provider] = useMemo(() => {
    const doc = new Y.Doc();
    const sharedType = doc.getArray<SyncElement>("content");
    const provider = new WebsocketProvider(WEBSOCKET_ENDPOINT, slug, doc, {
      connect: false,
    });
    return [sharedType, provider];
  }, [id]);

  const editor = useMemo(() => {
    const editor = withYjs(
      withLinks(withReact(withHistory(createEditor()))),
      sharedType
    );

    return editor;
  }, [sharedType]);

  useEffect(() => {
    provider.on("status", ({ status }: { status: string }) => {
      setOnlineState(status === "connected");
    });

    // Super hacky way to provide a initial value from the client, if
    // you plan to use y-websocket in prod you probably should provide the
    // initial state from the server.
    provider.on("sync", (isSynced: boolean) => {
      if (isSynced && sharedType.length === 0) {
        toSharedType(sharedType, [
          { type: "paragraph", children: [{ text: "Hello world!" }] },
        ]);
      }
    });

    provider.connect();

    return () => {
      provider.disconnect();
    };
  }, [provider]);

  const toggleOnline = () => {
    isOnline ? provider.disconnect() : provider.connect();
  };

  return (
    <Instance online={isOnline}>
      <Title>
        <Head>Editor: {name}</Head>
        <div style={{ display: "flex", marginTop: 10, marginBottom: 10 }}>
          <Button type="button" onClick={toggleOnline}>
            Go {isOnline ? "offline" : "online"}
          </Button>
          <Button type="button" onClick={() => removeUser(id)}>
            Remove
          </Button>
        </div>
      </Title>

      <EditorFrame
        editor={editor}
        value={value}
        onChange={(value: Node[]) => setValue(value)}
      />
    </Instance>
  );
};

export default Client;

const Head = styled(H4)`
  margin-right: auto;
`;
