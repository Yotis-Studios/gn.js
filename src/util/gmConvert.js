const Buffer = require('buffer').Buffer;

const typeMap = ['u8','u16','u32','s8','s16','s32','f16','f32','f64','string','buffer','undefined'];
const sizeMap = {u8: 1, u16: 2, u32: 4, s8: 1, s16: 2, s32: 4, f16: 2, f32: 4, f64: 8, undefined: 0};

/**
 * Get a buffer of binary data from provided data
 * @param {any} data The data to convert to a buffer
 * @returns {Buffer} The buffer of binary data
 */
function createBufferFromData(data) {
    const type = determineType(data);
    const typeName = typeMap[type];
    const typeSize = sizeMap[typeName];
    const typeBuffer = Buffer.alloc(1);
    typeBuffer.writeUInt8(type, 0);

    let buffer;
    switch (typeName) {
        case 'u8':
            buffer = Buffer.alloc(typeSize); // 1
            buffer.writeUInt8(data, 0);
            break;
        case 'u16':
            buffer = Buffer.alloc(typeSize); // 2
            buffer.writeUInt16LE(data, 0);
            break;
        case 'u32':
            buffer = Buffer.alloc(typeSize); // 4
            buffer.writeUInt32LE(data, 0);
            break;
        case 's8':
            buffer = Buffer.alloc(typeSize); // 1
            buffer.writeInt8(data, 0);
            break;
        case 's16':
            buffer = Buffer.alloc(typeSize); // 2
            buffer.writeInt16LE(data, 0);
            break;
        case 's32':
            buffer = Buffer.alloc(typeSize); // 4
            buffer.writeInt32LE(data, 0);
            break;
        case 'f16':
        case 'f32':
        case 'f64':
            buffer = Buffer.alloc(typeSize); // 4 or 8
            buffer.writeFloatLE(data, 0);
            break;
        case 'string':
            buffer = Buffer.from(data, 'utf8');
            // check buffer for null terminator
            if (buffer[buffer.length - 1] !== 0) {
                buffer = Buffer.concat([buffer, Buffer.from([0])]);
            }
            var strLen = buffer.length;
            var strLenBuffer = Buffer.alloc(2);
            strLenBuffer.writeUInt16LE(strLen, 0);
            buffer = Buffer.concat([strLenBuffer, buffer]);
            break;
        case 'buffer':
            var bufLen = data.length;
            var bufLenBuffer = Buffer.alloc(1);
            bufLenBuffer.writeUInt8(bufLen, 0);
            buffer = Buffer.concat([bufLenBuffer, data]);
            break;
        case 'undefined':
            buffer = Buffer.alloc(0);
            break;
    }
    const finalBuffer = Buffer.concat([typeBuffer, buffer]);
    return finalBuffer;
}

/**
 * Determines the binary data type of the provided data
 * @param {any} data The data to determine the type of
 * @returns {number} The type of the data (indexed in typeMap)
 */
function determineType(data) {
    switch (typeof data) {
        case 'number':
        case 'boolean':
            if (Number.isInteger(data)) {
                if (data >= 0) {
                    if (data < 256) {
                        return 0; // u8
                    } else if (data < 65536) {
                        return 1; // u16
                    } else {
                        return 2; // u32
                    }
                } else {
                    if (data > -129) {
                        return 3; // s8
                    } else if (data > -32769) {
                        return 4; // s16
                    } else {
                        return 5; // s32
                    }
                }
            } else {
                // ignore f16, not supported)
                if (Math.abs(data) <= 16777216) {
                    return 7; // f32
                }
                return 8; // f64
            }
        case 'string':
            return 9; // string
        case 'object':
            if (data instanceof Buffer) {
                return 10; // buffer
            }
            break;
        default:
            return 11; // undefined
    }  
}

/**
 * Used for parsing binary data from a packet buffer
 * @param {Buffer} buffer binary data
 * @param {number} index index to start reading from
 * @returns {object} object with data and size (number of bytes read)
 */
function parseDataFromBuffer(buffer, index) {
    const type = buffer.readUInt8(index);
    const typeName = typeMap[type];
    index++;

    let data, size;
    switch (typeName) {
        case 'u8':
            data = buffer.readUInt8(index);
            break;
        case 'u16':
            data = buffer.readUInt16LE(index);
            break;
        case 'u32':
            data = buffer.readUInt32LE(index);
            break;
        case 's8':
            data = buffer.readInt8(index);
            break;
        case 's16':
            data = buffer.readInt16LE(index);
            break;
        case 's32':
            data = buffer.readInt32LE(index);
            break;
        case 'f16':
        case 'f32':
            data = buffer.readFloatLE(index);
            break;
        case 'f64':
            data = buffer.readDoubleLE(index);
            break;
        case 'string':
            var strLen = buffer.readUInt16LE(index);
            index += 2;
            data = buffer.toString('utf8', index, index + strLen);
            size = strLen + 2;
            break;
        case 'buffer':
            var bufLen = buffer.readUInt8(index);
            index++;
            data = buffer.subarray(index, index + bufLen);
            size = bufLen + 1;
            break;
        case 'undefined':
            data = undefined;
            break;
    }
    if (size === undefined) {
        size = sizeMap[typeName];
    }
    return {data, size};
}

module.exports = {
    createBufferFromData,
    determineType,
    parseDataFromBuffer
};