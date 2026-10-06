# gn.js

`gn.js` is a lightweight, efficient, and scalable networking library for Node.js, designed for real-time applications. It uses the WebSocket protocol for communication and provides a simple and intuitive API for creating servers and clients. The library is designed with GameMaker compatibility in mind, making it an excellent choice for multiplayer GameMaker projects.

## Features

- Event-driven API for handling connections, disconnections, and messages.
- Efficient binary data handling with the `Packet` class.
- Support for both server-side and client-side networking.
- Designed for compatibility with GameMaker.

## Protocol

The binary wire format (framing, type ids, encoding and decoding rules) is specified in [PROTOCOL.md](PROTOCOL.md).

## Known limitations

- **Large numbers can't be sent.** JavaScript has one number type, so gn.js
  sends every whole number as an integer (u8 through s32) and throws if it is
  outside the 32-bit range. That includes values like `Date.now()` and any
  double larger than 2^53 (all of which are whole numbers). A thrown error in
  a `packet` handler crashes the Node process. Typed ports (gn.hml, gn.c) don't
  have this problem: they send large floats as f64.

## Installation

You can install `gn.js` using npm:

```bash
npm install gn-js
```

## API

### Server

The `Server` class represents a WebSocket server. It emits the following events:

- `ready`: Emitted when the server is ready to accept connections.
- `connect`: Emitted when a client connects to the server. The event handler receives a `Connection` object representing the client connection.
- `packet`: Emitted when the server receives a packet from a client. The event handler receives a `Connection` object and a `Packet` object.
- `disconnect`: Emitted when a client disconnects from the server. The event handler receives a `Connection` object.

### Client

The `Client` class represents a WebSocket client. It emits the following events:

- `connect`: Emitted when the client connects to a server.
- `packet`: Emitted when the client receives a packet from the server. The event handler receives a `Packet` object.
- `disconnect`: Emitted when the client disconnects from the server.

### Packet

The `Packet` class represents a packet of data. It provides methods for adding data to the packet and loading data from a buffer.
