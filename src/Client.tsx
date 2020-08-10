import styled from "@emotion/styled";
import React, { useEffect, useMemo, useState } from "react";
import { createEditor, Node } from "slate";
import { withHistory } from "slate-history";
import { withReact } from "slate-react";
import { WebsocketEditorOptions, withWebsocket, withYJs } from "slate-yjs";
import { Button, H4, Instance, Title } from "./Components";
import EditorFrame from "./EditorFrame";
import { withLinks } from "./plugins/link";

interface ClientProps {
  name: string;
  id: string;
  slug: string;
  removeUser: (id: any) => void;
}

const Client: React.FC<ClientProps> = ({ id, name, slug, removeUser }) => {
  const [value, setValue] = useState<Node[]>([]);
  const [isOnline, setOnlineState] = useState<boolean>(false);

  const editor = useMemo(() => {
    const slateEditor = withYJs(withLinks(withReact(withHistory(createEditor()))));

    const endpoint =
      process.env.NODE_ENV === "production" ? window.location.origin : "ws://localhost:9000";

    const options: WebsocketEditorOptions = {
      endpoint: endpoint,
      roomName: slug,
      onConnect: () => setOnlineState(true),
      onDisconnect: () => setOnlineState(false),
    };

    return withWebsocket(slateEditor, options);
  }, []);

  useEffect(() => {
    editor.connect();
    return editor.destroy;
  }, []);

  const toggleOnline = () => {
    const { connect, disconnect } = editor;
    isOnline ? disconnect() : connect();
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

      <EditorFrame editor={editor} value={value} onChange={(value: Node[]) => setValue(value)} />
    </Instance>
  );
};

export default Client;

const Head = styled(H4)`
  margin-right: auto;
`;
