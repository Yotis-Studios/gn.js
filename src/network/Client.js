const WebSocket = require('ws');
const EventEmitter = require('events');
const Packet = require('./Packet');
const Buffer = require('buffer').Buffer;

/**
 * @class Client
 * @extends EventEmitter
 * @description A client that connects to a server and sends/receives packets
 */
class Client extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.connected = false;
    }

    /**
     * @description Connects to a server
     * @param {string} address The address of the server
     * @param {number} port The port of the server
     * @returns {void}
     * @fires Client#connect
     * @fires Client#disconnect
     * @fires Client#packet
     */
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

    /**
     * @description Sends a packet to the server
     * @param {Packet} packet The packet to send
     * @returns {void}
     */
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

    /**
     * @description Disconnects from the server
     * @returns {void}
     */
    disconnect() {
        this.ws.end(1000, 'Client closed');
    }

    /**
     * @description Returns whether or not the client is connected to a server
     * @returns {boolean} Whether or not the client is connected to a server
     */
    isConnected() {
        return this.connected;
    }

    /**
     * @description Returns the WebSocket of the client
     * @returns {WebSocket} The WebSocket of the client
     */
    getWebSocket() {
        return this.ws;
    }
}

module.exports = Client;