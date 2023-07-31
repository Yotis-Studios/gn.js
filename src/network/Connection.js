const EventEmitter = require('events');
const Packet = require('./Packet');

class Connection extends EventEmitter {
    constructor(ws, server) {
        super();
        this.ws = ws;
        this.server = server;
    }

    send(packet) {
        const data = packet instanceof Packet ? packet.build() : packet; // build a packet or send as raw data
        this.ws.send(data);
    }

    broadcast(packet) {
        this.server.broadcast(packet, this);
    }

    kick() {
        this.ws.end(1000, 'Kicked');
    }
}

module.exports = Connection;