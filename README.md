# gn.js

`gn.js` is a lightweight, efficient, and scalable networking library for Node.js, designed for real-time applications. It uses the WebSocket protocol for communication and provides a simple and intuitive API for creating servers and clients. The library is designed with GameMaker compatibility in mind, making it an excellent choice for multiplayer GameMaker projects.

## Features

- Event-driven API for handling connections, disconnections, and messages.
- Efficient binary data handling with the `Packet` class.
- Support for both server-side and client-side networking.
- Designed for compatibility with GameMaker.

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
