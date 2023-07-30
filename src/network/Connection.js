const EventEmitter = require('events');

class Connection extends EventEmitter {
    constructor(ws, server) {
        super();
        this.ws = ws;
        this.server = server;
    }

    send(packet) {
        const data = packet.build();
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