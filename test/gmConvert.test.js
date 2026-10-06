const Buffer = require('buffer').Buffer;
const gmConvert = require('../src/util/gmConvert');

describe('determineType', () => {
    test('unsigned integers', () => {
        expect(gmConvert.determineType(0)).toBe(0);     // u8
        expect(gmConvert.determineType(255)).toBe(0);    // u8
        expect(gmConvert.determineType(256)).toBe(1);    // u16
        expect(gmConvert.determineType(65535)).toBe(1);  // u16
        expect(gmConvert.determineType(65536)).toBe(2);  // u32
    });

    test('signed integers', () => {
        expect(gmConvert.determineType(-1)).toBe(3);      // s8
        expect(gmConvert.determineType(-128)).toBe(3);    // s8
        expect(gmConvert.determineType(-129)).toBe(4);    // s16
        expect(gmConvert.determineType(-32768)).toBe(4);  // s16
        expect(gmConvert.determineType(-32769)).toBe(5);  // s32
    });

    test('floats', () => {
        expect(gmConvert.determineType(1.5)).toBe(7);           // f32
        expect(gmConvert.determineType(-3.14)).toBe(7);         // f32
        expect(gmConvert.determineType(16777216.5)).toBe(8);    // f64 (abs > 16777216)
        expect(gmConvert.determineType(16777217)).toBe(2);      // u32 (integer, fits in u32)
    });

    test('strings', () => {
        expect(gmConvert.determineType('hello')).toBe(9);
        expect(gmConvert.determineType('')).toBe(9);
    });

    test('buffers', () => {
        expect(gmConvert.determineType(Buffer.from([1, 2, 3]))).toBe(10);
    });

    test('undefined', () => {
        expect(gmConvert.determineType(undefined)).toBe(11);
    });

    test('null and non-Buffer objects are undefined', () => {
        expect(gmConvert.determineType(null)).toBe(11);
        expect(gmConvert.determineType({})).toBe(11);
        expect(gmConvert.createBufferFromData(null)).toEqual(Buffer.from([11]));
    });

    test('booleans are u8 1/0 (matches gn.hml)', () => {
        expect(gmConvert.determineType(true)).toBe(0);
        expect(gmConvert.determineType(false)).toBe(0);
        expect(gmConvert.createBufferFromData(true)).toEqual(Buffer.from([0, 1]));
        expect(gmConvert.createBufferFromData(false)).toEqual(Buffer.from([0, 0]));
    });
});

describe('createBufferFromData + parseDataFromBuffer roundtrip', () => {
    function roundtrip(value) {
        const buf = gmConvert.createBufferFromData(value);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        return result.data;
    }

    test('u8 roundtrip', () => {
        expect(roundtrip(0)).toBe(0);
        expect(roundtrip(255)).toBe(255);
        expect(roundtrip(42)).toBe(42);
    });

    test('u16 roundtrip', () => {
        expect(roundtrip(256)).toBe(256);
        expect(roundtrip(65535)).toBe(65535);
    });

    test('u32 roundtrip', () => {
        expect(roundtrip(65536)).toBe(65536);
        expect(roundtrip(4294967295)).toBe(4294967295);
    });

    test('s8 roundtrip', () => {
        expect(roundtrip(-1)).toBe(-1);
        expect(roundtrip(-128)).toBe(-128);
    });

    test('s16 roundtrip', () => {
        expect(roundtrip(-129)).toBe(-129);
        expect(roundtrip(-32768)).toBe(-32768);
    });

    test('s32 roundtrip', () => {
        expect(roundtrip(-32769)).toBe(-32769);
        expect(roundtrip(-2147483648)).toBe(-2147483648);
    });

    test('f32 roundtrip', () => {
        const val = roundtrip(1.5);
        expect(val).toBeCloseTo(1.5, 5);
    });

    test('f64 roundtrip', () => {
        const large = 123456789.123456789;
        const val = roundtrip(large);
        expect(val).toBeCloseTo(large, 8);
    });

    test('string roundtrip', () => {
        expect(roundtrip('hello')).toBe('hello');
        expect(roundtrip('')).toBe('');
        expect(roundtrip('unicode: \u00e9\u00e0\u00fc')).toBe('unicode: \u00e9\u00e0\u00fc');
    });

    test('string does not include null terminator', () => {
        const result = roundtrip('test');
        expect(result).toBe('test');
        expect(result.length).toBe(4);
        expect(result.indexOf('\0')).toBe(-1);
    });

    test('buffer roundtrip', () => {
        const input = Buffer.from([1, 2, 3, 4, 5]);
        const result = roundtrip(input);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(Buffer.compare(result, input)).toBe(0);
    });

    test('undefined roundtrip', () => {
        expect(roundtrip(undefined)).toBeUndefined();
    });
});

describe('createBufferFromData', () => {
    test('type byte is first byte', () => {
        const buf = gmConvert.createBufferFromData(42);
        expect(buf[0]).toBe(0); // u8 type

        const buf2 = gmConvert.createBufferFromData('hi');
        expect(buf2[0]).toBe(9); // string type
    });

    test('string includes length prefix and null terminator', () => {
        const buf = gmConvert.createBufferFromData('ab');
        // type(1) + length(2) + 'a'(1) + 'b'(1) + null(1) = 6
        expect(buf.length).toBe(6);
        expect(buf[0]).toBe(9); // string type
        const strLen = buf.readUInt16LE(1);
        expect(strLen).toBe(3); // 'ab' + null
        expect(buf[buf.length - 1]).toBe(0); // null terminator
    });
});

describe('parseDataFromBuffer edge cases', () => {
    test('returns undefined for out-of-bounds index', () => {
        const buf = Buffer.from([]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(-1);
    });

    test('returns undefined for invalid type byte', () => {
        const buf = Buffer.from([255]); // invalid type
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(-1);
    });
});

describe('parseDataFromBuffer malformed input', () => {
    const truncated = {
        u8: [0], u16: [1, 0], u32: [2, 0, 0, 0], s8: [3], s16: [4, 0], s32: [5, 0, 0, 0],
        f16: [6, 0], f32: [7, 0, 0, 0], f64: [8, 0, 0, 0, 0, 0, 0, 0],
        'string length': [9, 5], 'string body': [9, 5, 0, 97, 98], 'buffer length': [10],
        'buffer body': [10, 4, 1, 2],
    };
    for (const [name, bytes] of Object.entries(truncated)) {
        test(`truncated ${name} fails without throwing`, () => {
            const result = gmConvert.parseDataFromBuffer(Buffer.from(bytes), 0);
            expect(result.size).toBe(-1);
        });
    }

    test('undefined parses with size 0 (not a failure)', () => {
        const result = gmConvert.parseDataFromBuffer(Buffer.from([11]), 0);
        expect(result).toEqual({ data: undefined, size: 0 });
    });
});

describe('f16 decoding', () => {
    const f16 = (bits) => gmConvert.parseDataFromBuffer(Buffer.from([6, bits & 0xff, bits >> 8]), 0);
    test('consumes 2 bytes', () => {
        expect(f16(0x3c00).size).toBe(2);
    });
    test('decodes values', () => {
        expect(f16(0x3c00).data).toBe(1);
        expect(f16(0xc000).data).toBe(-2);
        expect(f16(0x3555).data).toBeCloseTo(0.333, 3);
        expect(f16(0x7bff).data).toBe(65504);
        expect(f16(0x0001).data).toBe(Math.pow(2, -24));
        expect(f16(0x7c00).data).toBe(Infinity);
        expect(f16(0xfc00).data).toBe(-Infinity);
        expect(f16(0x7e00).data).toBeNaN();
    });
    test('f16 followed by more data parses in a packet', () => {
        const Packet = require('../src/network/Packet');
        const p = new Packet();
        p.load(Buffer.from([1, 0, 6, 0x00, 0x3c, 0, 7]));
        expect(p.data).toEqual([1, 7]);
    });
});

describe('multi-value buffer parsing', () => {
    test('multiple values serialize and parse correctly', () => {
        const values = [42, 'hello', -7, 1.5];
        const buffers = values.map(v => gmConvert.createBufferFromData(v));
        const combined = Buffer.concat(buffers);

        const parsed = [];
        let i = 0;
        while (i < combined.length) {
            const result = gmConvert.parseDataFromBuffer(combined, i);
            if (result.size < 0) break;
            parsed.push(result.data);
            i += result.size + 1; // +1 for type byte
        }

        expect(parsed[0]).toBe(42);
        expect(parsed[1]).toBe('hello');
        expect(parsed[2]).toBe(-7);
        expect(parsed[3]).toBeCloseTo(1.5, 5);
    });
});
