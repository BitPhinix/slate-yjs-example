import React from "react";

interface Caret {
  isForward: boolean;
  data: { name: string; color: string };
}

const Caret: React.FC<Caret> = ({ data, isForward }) => {
  const cursorStyles = {
    ...cursorStyleBase,
    background: data.color,
    left: isForward ? "100%" : "0%",
  };
  const caretStyles = {
    ...caretStyleBase,
    background: data.color,
    left: isForward ? "100%" : "0%",
  };

  caretStyles[isForward ? "bottom" : "top"] = 0;

  return (
    <>
      <span contentEditable={false} style={caretStyles}>
        <span style={{ position: "relative" }}>
          <span contentEditable={false} style={cursorStyles}>
            {data.name}
          </span>
        </span>
      </span>
    </>
  );
};

export default Caret;

const cursorStyleBase = {
  position: "absolute",
  top: -2,
  pointerEvents: "none",
  userSelect: "none",
  transform: "translateY(-100%)",
  fontSize: 10,
  color: "white",
  background: "palevioletred",
  whiteSpace: "nowrap",
} as any;

const caretStyleBase = {
  position: "absolute",
  pointerEvents: "none",
  userSelect: "none",
  height: "1.2em",
  width: 2,
  background: "palevioletred",
} as any;
