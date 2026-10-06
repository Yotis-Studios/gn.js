const Buffer = require('buffer').Buffer;

const typeMap = ['u8','u16','u32','s8','s16','s32','f16','f32','f64','string','buffer','undefined'];
const sizeMap = {u8: 1, u16: 2, u32: 4, s8: 1, s16: 2, s32: 4, f16: 2, f32: 4, f64: 8, undefined: 0};

/**
 * Get a buffer of binary data from provided data
 * @param {any} data The data to convert to a buffer
 * @returns {Buffer} The buffer of binary data
 */
function createBufferFromData(data) {
    // booleans go on the wire as u8 1/0 (matches gn.hml)
    if (typeof data === 'boolean') data = data ? 1 : 0;
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
            buffer = Buffer.alloc(typeSize); // 2 or 4
            buffer.writeFloatLE(data, 0);
            break;
        case 'f64':
            buffer = Buffer.alloc(typeSize); // 8
            buffer.writeDoubleLE(data, 0);
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
        case 'boolean':
            return 0; // u8 (1/0)
        case 'number':
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
            return 11; // undefined (null, arrays, plain objects)
        default:
            return 11; // undefined
    }  
}

/**
 * Decodes an IEEE 754 half-precision float
 * @param {number} h 16-bit half float bits
 * @returns {number}
 */
function halfToFloat(h) {
    const sign = (h & 0x8000) ? -1 : 1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;
    if (exp === 0) return sign * frac * Math.pow(2, -24); // subnormal
    if (exp === 31) return frac ? NaN : sign * Infinity;
    return sign * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

// result returned when data can't be parsed (out of bounds, truncated or unknown type)
const PARSE_FAIL = { data: undefined, size: -1 };

/**
 * Used for parsing binary data from a packet buffer
 * @param {Buffer} buffer binary data
 * @param {number} index index to start reading from
 * @returns {object} object with data and size (number of bytes read after the type byte),
 *                   size is -1 if the data could not be parsed
 */
function parseDataFromBuffer(buffer, index) {
    if (index >= buffer.length) return PARSE_FAIL;
    const type = buffer.readUInt8(index);
    if (type >= typeMap.length) return PARSE_FAIL;
    const typeName = typeMap[type];
    index++;
    const remaining = buffer.length - index;

    let data, size;
    switch (typeName) {
        case 'string': {
            if (remaining < 2) return PARSE_FAIL;
            const strLen = buffer.readUInt16LE(index);
            if (remaining < 2 + strLen) return PARSE_FAIL;
            index += 2;
            // strip null terminator if present
            const strEnd = strLen > 0 && buffer[index + strLen - 1] === 0 ? strLen - 1 : strLen;
            data = buffer.toString('utf8', index, index + strEnd);
            size = strLen + 2;
            break;
        }
        case 'buffer': {
            if (remaining < 1) return PARSE_FAIL;
            const bufLen = buffer.readUInt8(index);
            if (remaining < 1 + bufLen) return PARSE_FAIL;
            index++;
            data = buffer.subarray(index, index + bufLen);
            size = bufLen + 1;
            break;
        }
        default:
            size = sizeMap[typeName];
            if (remaining < size) return PARSE_FAIL;
            switch (typeName) {
                case 'u8': data = buffer.readUInt8(index); break;
                case 'u16': data = buffer.readUInt16LE(index); break;
                case 'u32': data = buffer.readUInt32LE(index); break;
                case 's8': data = buffer.readInt8(index); break;
                case 's16': data = buffer.readInt16LE(index); break;
                case 's32': data = buffer.readInt32LE(index); break;
                case 'f16': data = halfToFloat(buffer.readUInt16LE(index)); break;
                case 'f32': data = buffer.readFloatLE(index); break;
                case 'f64': data = buffer.readDoubleLE(index); break;
                case 'undefined': data = undefined; break;
            }
    }
    return {data, size};
}

module.exports = {
    createBufferFromData,
    determineType,
    parseDataFromBuffer
};