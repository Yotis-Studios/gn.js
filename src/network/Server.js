const WebSocket = require('ws');
const EventEmitter = require('events');
const Packet = require('./Packet');
const Connection = require('./Connection');
const Buffer = require('buffer').Buffer;

class Server extends EventEmitter {
    constructor() {
        super();
        this.port = null;
        this.connections = new Set();
        this.server = null;
    }

    handleConnect(ws) {
        const connection = new Connection(ws, this);
        this.connections.add(connection);
        this.emit('connect', connection);
    }

    handleDisconnect(ws, code, message) {
        const connection = this.getConnectionByWebSocket(ws);
        connection.code = code;
        connection.message = message;
        this.connections.delete(connection);
        this.emit('disconnect', connection);
    }

    handleData(ws, message, isBinary) {
        if (!isBinary) {
            console.error('Received non-binary data: ' + message);
            return;
        }
        // find the connection that sent this data
        const connection = this.getConnectionByWebSocket(ws);
        if (!connection) {
            console.error('Received data from unknown connection');
            return;
        }
        // convert the message to a buffer
        message = Buffer.from(message);
        // get packet size from message
        const size = message.readUInt16LE(0);
        // make new packet and load the net id and data limited to the provided size
        const packet = new Packet();
        packet.load(message.subarray(2, 2+size));

        // emit the packet
        this.emit('packet', connection, packet);
    }

    listen(port) {
        this.port = port;
        this.server = new WebSocket.Server({ port: port });
        this.server.on('connection', (ws) => {
            this.handleConnect(ws);
            ws.on('close', (code, message) => {
                this.handleDisconnect(ws, code, message);
            });
            ws.on('message', (message, isBinary) => {
                this.handleData(ws, message, isBinary);
            });
        });
    }

    broadcast(packet, exclude = null) {
        const data = packet.build();
        for (const conn of this.connections) {
            if (conn === exclude) continue;
            conn.send(data);
        }
    }

    close() {
        for (const conn of this.connections) {
            conn.kick();
        }
        this.server.close(() => {
            console.log(`Server on port ${this.port} closed`);
        });
    }

    getConnectionByWebSocket(ws) {
        for (const connection of this.connections) {
            if (connection.ws === ws) return connection;
        }
        return null;
    }
}

module.exports = Server;