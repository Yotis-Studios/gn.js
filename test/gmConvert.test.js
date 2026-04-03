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

    test('null maps to undefined type', () => {
        expect(gmConvert.determineType(null)).toBe(11); // undefined
    });

    test('non-Buffer objects map to undefined type', () => {
        expect(gmConvert.determineType({})).toBe(11);
        expect(gmConvert.determineType([])).toBe(11);
    });

    test('booleans treated as floats (typeof number, not integer)', () => {
        // Boolean true/false: typeof is 'number' case but Number.isInteger(true) is true
        // Actually: typeof true === 'boolean', which matches 'number'|'boolean' case
        // But Number.isInteger(true) === true, so true(1) -> u8, false(0) -> u8
        // Let's verify actual behavior:
        const trueType = gmConvert.determineType(true);
        const falseType = gmConvert.determineType(false);
        // boolean goes into the number/boolean case but Number.isInteger(true) behavior
        // depends on JS engine — just snapshot actual behavior
        expect(trueType).toBe(7);  // f32 — booleans aren't Number.isInteger
        expect(falseType).toBe(7); // f32
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
        expect(result.size).toBe(0);
    });

    test('returns undefined for invalid type byte', () => {
        const buf = Buffer.from([255]); // invalid type
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });
});

describe('null and object handling', () => {
    test('null roundtrips as undefined', () => {
        const buf = gmConvert.createBufferFromData(null);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
    });

    test('plain object roundtrips as undefined', () => {
        const buf = gmConvert.createBufferFromData({});
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
    });

    test('array roundtrips as undefined', () => {
        const buf = gmConvert.createBufferFromData([1, 2, 3]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
    });
});

describe('buffer type with large buffers', () => {
    test('buffer > 255 bytes roundtrips correctly', () => {
        const input = Buffer.alloc(300, 0xAB);
        const buf = gmConvert.createBufferFromData(input);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(Buffer.isBuffer(result.data)).toBe(true);
        expect(result.data.length).toBe(300);
        expect(Buffer.compare(result.data, input)).toBe(0);
    });
});

describe('parseDataFromBuffer bounds checking', () => {
    test('returns undefined for truncated u16', () => {
        // type byte for u16 (1) + only 1 byte of data (needs 2)
        const buf = Buffer.from([1, 0xFF]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for truncated u32', () => {
        // type byte for u32 (2) + only 2 bytes of data (needs 4)
        const buf = Buffer.from([2, 0xFF, 0xFF]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for truncated f64', () => {
        // type byte for f64 (8) + only 4 bytes (needs 8)
        const buf = Buffer.from([8, 0, 0, 0, 0]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for truncated string length', () => {
        // type byte for string (9) + only 1 byte (needs 2 for length prefix)
        const buf = Buffer.from([9, 0x05]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for string with length exceeding buffer', () => {
        // type byte for string (9) + length says 100 but only 2 bytes of data
        const buf = Buffer.from([9, 100, 0, 0x41, 0x42]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for truncated buffer type', () => {
        // type byte for buffer (10) + only 1 byte (needs 2 for length prefix)
        const buf = Buffer.from([10, 0x05]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
    });

    test('returns undefined for buffer with length exceeding data', () => {
        // type byte for buffer (10) + length says 100 but only 2 bytes follow
        const buf = Buffer.from([10, 100, 0, 0xAA, 0xBB]);
        const result = gmConvert.parseDataFromBuffer(buf, 0);
        expect(result.data).toBeUndefined();
        expect(result.size).toBe(0);
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
            if (result.size === 0 && result.data === undefined) break;
            parsed.push(result.data);
            i += result.size + 1; // +1 for type byte
        }

        expect(parsed[0]).toBe(42);
        expect(parsed[1]).toBe('hello');
        expect(parsed[2]).toBe(-7);
        expect(parsed[3]).toBeCloseTo(1.5, 5);
    });
});
