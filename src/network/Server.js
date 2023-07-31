const uWS = require('uWebSockets.js');
const EventEmitter = require('events');
const Packet = require('./Packet');
const Connection = require('./Connection');
const Buffer = require('buffer').Buffer;

class Server extends EventEmitter {
    constructor() {
        super();
        this.port = null;
        this.connections = new Set();

        this.server = uWS.App().ws('/*', {
            /* Options */
            compression: 0,
            maxPayloadLength: 1024,
            idleTimeout: 32,

            /* Handlers */
            open: this.handleConnect.bind(this),
            message: this.handleData.bind(this),
            drain: (ws) => {
                console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
            },
            close: this.handleDisconnect.bind(this)
        });
    }

    handleConnect(ws) {
        const connection = new Connection(ws, this);
        this.connections.add(connection);
        this.emit('connect', connection);
    }

    handleDisconnect(ws, code, message) {
        this.connections.delete(ws);
        this.emit('disconnect', ws, code, message);
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
        this.server.listen(this.port, (token) => {
            if (token) {
                console.log('Listening to port ' + this.port);
                this.emit('ready');
            } else {
                console.error('Failed to listen to port ' + this.port);
            }
        });
    }

    broadcast(packet, exclude = null) {
        const data = packet.build();
        for (const ws of this.connections) {
            if (ws === exclude) continue;
            ws.send(data);
        }
    }

    close() {
        for (const ws of this.connections) {
            ws.end(1000, 'Server closed');
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