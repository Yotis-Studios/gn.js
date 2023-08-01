const EventEmitter = require('events');
const Packet = require('./Packet');

/**
 * @class Connection
 * @extends EventEmitter
 * @description Represents a connection to the server
 */
class Connection extends EventEmitter {
    /**
     * @description Creates an instance of Connection
     * @constructor
     * @param {WebSocket} ws The WebSocket of the connection
     * @param {Server} server The server the connection is on
     */
    constructor(ws, server) {
        super();
        this.ws = ws;
        this.server = server;

        // websocket fields
        this.code = null;
        this.message = null;
    }

    /**
     * @description Sends a packet to the connection
     * @param {Packet|Buffer} packet The packet to send
     * @returns {void}
     */
    send(packet) {
        const data = packet instanceof Packet ? packet.build() : packet; // build a packet or send as raw data
        this.ws.send(data);
    }

    /**
     * @description Broadcasts a packet to all connections this connection's server (except this one)
     * @param {Packet|Buffer} packet The packet to broadcast
     * @returns {void}
     */
    broadcast(packet) {
        this.server.broadcast(packet, this);
    }

    /**
     * @description Closes this connection to the server
     * @returns {void}
     */
    kick() {
        this.ws.close();
    }
}

module.exports = Connection;