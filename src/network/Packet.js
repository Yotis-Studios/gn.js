const Buffer = require('buffer').Buffer;
const gmConvert = require('../util/gmConvert');

/**
 * Represents a packet of data to be sent over the network.
 */
class Packet {
    constructor(netId) {
        this.netId = netId;
        this.data = [];
    }

    /**
     * Push data to the packet
     * @param {any} data
     * @returns {void}
     */
    add(data) {
        if (Array.isArray(data)) {
            this.data = this.data.concat(data);
        } else {
            this.data.push(data);
        }
    }

    /**
     * Access data at index i from the packet
     * @param {number} i
     * @returns {any}
     */
    get(i) {
        return this.data[i];
    }

    /**
     * Loads raw byte data into a packet
     * @param {Buffer} data
     * @returns {void}
     */
    load(data) {
        this.netId = data.readUInt16LE(0);

        if (data.length > 2) {
            let i = 2;
            while (i < data.length) {
                const parse = gmConvert.parseDataFromBuffer(data, i);
                this.data.push(parse.data);
                i += parse.size+1;
            }
        }
    }

    /**
     * Serializes the packet data into a buffer ready to be sent over the network
     * @returns {Buffer}
     */
    build() {
        let size = 2; // 2 bytes for netID
        const netIDBuffer = Buffer.alloc(2);
        netIDBuffer.writeUInt16LE(this.netId);

        // iterate through data, convert to buffers, and add to array, while keeping track of size
        const dataBuffers = [];
        for (const data of this.data) {
            const buffer = gmConvert.createBufferFromData(data);
            dataBuffers.push(buffer);
            size += buffer.length;
        }

        // 2 bytes for size
        const sizeBuffer = Buffer.alloc(2);
        sizeBuffer.writeUInt16LE(size);

        // return the concatenated buffers, [size, netID, ...data]
        return Buffer.concat([sizeBuffer, netIDBuffer, ...dataBuffers]);
    }
}

module.exports = Packet;