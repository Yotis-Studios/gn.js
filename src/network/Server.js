const http = require('http');
const WebSocket = require('ws');
const EventEmitter = require('events');
const Packet = require('./Packet');
const Connection = require('./Connection');
const Buffer = require('buffer').Buffer;

/**
 * @class Server
 * @extends EventEmitter
 * @description A server that listens for connections and broadcasts packets to all connections
 */
class Server extends EventEmitter {
    /**
     * @description Creates an instance of Server
     * @constructor
     */
    constructor() {
        super();
        this.connections = new Set();
        this.server = null;
        this.port = null;
        this.httpServer = null;
    }

    /**
     * @description Handles a new connection
     * @param {WebSocket} ws The WebSocket of the connection
     * @returns {void}
     * @fires Server#connect
     */
    handleConnect(ws) {
        const connection = new Connection(ws, this);
        this.connections.add(connection);
        this.emit('connect', connection);
    }

    /**
     * @description Handles a disconnection
     * @param {WebSocket} ws The WebSocket of the connection
     * @param {number} code The close code
     * @param {Buffer} message WS reason for closing
     * @returns {void}
     * @fires Server#disconnect
     */
    handleDisconnect(ws, code, message) {
        const connection = this.getConnectionByWebSocket(ws);
        connection.code = code;
        connection.message = message;
        this.connections.delete(connection);
        this.emit('disconnect', connection);
    }

    /**
     * @description Handles data from a connection
     * @param {WebSocket} ws The WebSocket of the connection
     * @param {Buffer} message The data received
     * @param {boolean} isBinary Whether the data is binary
     * @returns {void}
     * @fires Server#packet
     */
    handleData(ws, message, isBinary) {
        if (!isBinary) {
            console.error('Received non-binary data: ' + message);
            this.emit('error', 'Received non-binary data: ' + message, ws);
            return;
        }
        // find the connection that sent this data
        const connection = this.getConnectionByWebSocket(ws);
        if (!connection) {
            console.error('Received data from unknown connection');
            this.emit('error', 'Received data from unknown connection', ws);
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

    /**
     * @description Starts the server
     * @param {number|http.Server} portOrHttpServer The port to listen on or an http.Server to use
     * @returns {void}
     * @fires Server#ready
     */
    listen(portOrHttpServer) {
        let port;
        // If an HTTP server is provided, use it
        if (portOrHttpServer instanceof http.Server) {
            this.server = new WebSocket.Server({ server: portOrHttpServer });
            port = portOrHttpServer.address().port;
            this.httpServer = portOrHttpServer;
        } else {
            this.server = new WebSocket.Server({ port: portOrHttpServer });
            port = portOrHttpServer;
        }
        this.port = port;
        this.server.on('listening', () => {
            console.log(`Server listening on port ${port}`);
            this.emit('ready');
        });
        this.server.on('connection', (ws) => {
            this.handleConnect(ws);
            ws.on('close', (code, message) => {
                this.handleDisconnect(ws, code, message);
            });
            ws.on('message', (message, isBinary) => {
                this.handleData(ws, message, isBinary);
            });
            ws.on('error', (err) => {
                console.error(err);
                this.emit('error', err, ws);
            });
        });
        this.server.on('error', (err) => {
            console.error(err);
            this.emit('error', err);
        });
    }

    /**
     * @description Broadcasts a packet to all connections
     * @param {Packet} packet The packet to broadcast
     * @param {Connection} [exclude=null] The connection to exclude from the broadcast
     * @returns {void}
     */
    broadcast(packet, exclude = null) {
        const data = packet.build();
        for (const conn of this.connections) {
            if (conn === exclude) continue;
            conn.send(data);
        }
    }

    /**
     * @description Closes the server
     * @returns {void}
     */
    close() {
        for (const conn of this.connections) {
            conn.kick();
        }
        this.server.close(() => {
            console.log(`Server on port ${this.port} closed`);
        });
    }

    /**
     * @description Gets a connection by its WebSocket
     * @param {WebSocket} ws The WebSocket of the connection
     * @returns {Connection|null} The connection or null if not found
     */
    getConnectionByWebSocket(ws) {
        for (const connection of this.connections) {
            if (connection.ws === ws) return connection;
        }
        return null;
    }
}

module.exports = Server;