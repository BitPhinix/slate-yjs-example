# Slate Yjs Example project - [Live Demo](https://bitphinix.github.io/slate-yjs-example)

Demo app for [slate-yjs](https://github.com/bitphinix/slate-yjs)

Example ported from [slate-collaborative](https://github.com/cudr/slate-collaborative)

![](/public/preview.gif?raw=true)

# Usage

## Setup

Clone this repository and run `npm install` as usual.

## Execution

Open two terminals and execute the following commands:

### Terminal 1 (Server)

```
npm run start:server
```

### Terminal 2 (Frontend)

```
npm run start:cra
```

## Build

To build the application, run `npm run build`.

### Known issues

If you directly see some line break errors by prettier, make sure to handle your line ending correctly (on Windows).
Set the configuration of git and your local editor (e.g. (VS Code)[https://medium.com/@csmunuku/windows-and-linux-eol-sequence-configure-vs-code-and-git-37be98ef71df#:~:text=VS%20Code%20%3D%3E%20Settings%20%3D%3E,new%20files%20that%20you%20create.]) correctly.

# What about scaling, persistence etc. ?

Take a look at the [y-websocket readme](https://github.com/yjs/y-websocket)
