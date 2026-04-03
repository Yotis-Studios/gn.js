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
     * @fires Client#error
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
            // parse all packets from the message
            let offset = 0;
            while (offset + 2 <= data.length) {
                const size = data.readUInt16LE(offset);
                if (size === 0 || offset + 2 + size > data.length) break;
                const packet = new Packet();
                packet.load(data.subarray(offset + 2, offset + 2 + size));
                this.emit('packet', packet);
                offset += 2 + size;
            }
        };
        this.ws.onclose = () => {
            this.connected = false;
            this.emit('disconnect');
        };
        this.ws.onerror = (error) => {
            console.error(error);
            this.emit('error', error);
        }
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
        if (this.ws) {
            this.ws.close(1000, 'Client closed');
        }
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