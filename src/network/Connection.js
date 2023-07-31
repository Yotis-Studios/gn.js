const EventEmitter = require('events');
const Packet = require('./Packet');

class Connection extends EventEmitter {
    constructor(ws, server) {
        super();
        this.ws = ws;
        this.server = server;

        // websocket fields
        this.code = null;
        this.message = null;
    }

    send(packet) {
        const data = packet instanceof Packet ? packet.build() : packet; // build a packet or send as raw data
        this.ws.send(data);
    }

    broadcast(packet) {
        this.server.broadcast(packet, this);
    }

    kick() {
        if (this.ws.readyState !== 1) return; // if the websocket is not open, don't try to close it
        this.ws.end(1000, 'Kicked');
    }
}

module.exports = Connection;