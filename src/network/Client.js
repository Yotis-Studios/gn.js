const WebSocket = require('ws');
const EventEmitter = require('events');
const Packet = require('./Packet');
const Buffer = require('buffer').Buffer;

class Client extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.connected = false;
    }

    connect(address, port) {
        const url = 'ws://' + address + ':' + port;
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => {
            this.connected = true;
            this.emit('connect');
        };
        this.ws.onmessage = (event) => {
            // convert the message to a buffer
            const data = Buffer.from(event.data);
            // get packet size from message
            const size = data.readUInt16LE(0);
            // make new packet and load the net id and data limited to the provided size
            const packet = new Packet();
            packet.load(data.subarray(2, 2+size));
            // emit the packet
            this.emit('packet', packet);
        };
        this.ws.onclose = () => {
            this.connected = false;
            this.emit('disconnect');
        };
    }

    send(packet) {
        if (!this.ws) {
            console.error('Cannot send packet, WebSocket is null');
            return;
        }
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.error('Cannot send packet, WebSocket is not open');
            return;
        }
        const data = packet.build();
        this.ws.send(data);
    }

    disconnect() {
        this.ws.end(1000, 'Client closed');
    }

    isConnected() {
        return this.connected;
    }

    getWebSocket() {
        return this.ws;
    }
}

module.exports = Client;