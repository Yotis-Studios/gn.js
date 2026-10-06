const Packet = require('../src/network/Packet');
const Buffer = require('buffer').Buffer;

describe('Packet', () => {
    describe('constructor', () => {
        test('initializes with netId and empty data', () => {
            const packet = new Packet(1);
            expect(packet.netId).toBe(1);
            expect(packet.data).toEqual([]);
        });
    });

    describe('add', () => {
        test('adds single value', () => {
            const packet = new Packet(1);
            packet.add(42);
            expect(packet.data).toEqual([42]);
        });

        test('adds array of values', () => {
            const packet = new Packet(1);
            packet.add([1, 2, 3]);
            expect(packet.data).toEqual([1, 2, 3]);
        });

        test('accumulates data across multiple adds', () => {
            const packet = new Packet(1);
            packet.add(1);
            packet.add('hello');
            expect(packet.data).toEqual([1, 'hello']);
        });
    });

    describe('get', () => {
        test('retrieves data at index', () => {
            const packet = new Packet(1);
            packet.add([10, 20, 30]);
            expect(packet.get(0)).toBe(10);
            expect(packet.get(1)).toBe(20);
            expect(packet.get(2)).toBe(30);
        });

        test('returns undefined for out-of-bounds', () => {
            const packet = new Packet(1);
            expect(packet.get(0)).toBeUndefined();
        });
    });

    describe('load robustness', () => {
        test('undefined in the middle does not truncate the packet', () => {
            const original = new Packet(1);
            original.add([1, undefined, 2, 'x']);
            const loaded = new Packet();
            loaded.load(original.build().subarray(2));
            expect(loaded.data).toEqual([1, undefined, 2, 'x']);
        });

        test('truncated data keeps values before it and does not throw', () => {
            const loaded = new Packet();
            // netId 1, u8 7, then a u16 with only 1 byte
            loaded.load(Buffer.from([1, 0, 0, 7, 1, 5]));
            expect(loaded.netId).toBe(1);
            expect(loaded.data).toEqual([7]);
        });

        test('string with length past the end does not throw', () => {
            const loaded = new Packet();
            loaded.load(Buffer.from([1, 0, 9, 0xff, 0xff, 97]));
            expect(loaded.data).toEqual([]);
        });
    });

    describe('build and load roundtrip', () => {
        test('empty packet roundtrip', () => {
            const original = new Packet(5);
            const built = original.build();
            const loaded = new Packet();
            // skip the 2-byte size prefix
            loaded.load(built.subarray(2));
            expect(loaded.netId).toBe(5);
            expect(loaded.data).toEqual([]);
        });

        test('packet with integers', () => {
            const original = new Packet(10);
            original.add([1, 256, 70000, -5, -200, -40000]);
            const built = original.build();
            const loaded = new Packet();
            loaded.load(built.subarray(2));
            expect(loaded.netId).toBe(10);
            expect(loaded.data).toEqual([1, 256, 70000, -5, -200, -40000]);
        });

        test('packet with string', () => {
            const original = new Packet(3);
            original.add('hello world');
            const built = original.build();
            const loaded = new Packet();
            loaded.load(built.subarray(2));
            expect(loaded.netId).toBe(3);
            expect(loaded.data).toEqual(['hello world']);
        });

        test('packet with mixed types', () => {
            const original = new Packet(7);
            original.add(42);
            original.add('test');
            original.add(-100);
            const built = original.build();
            const loaded = new Packet();
            loaded.load(built.subarray(2));
            expect(loaded.netId).toBe(7);
            expect(loaded.data[0]).toBe(42);
            expect(loaded.data[1]).toBe('test');
            expect(loaded.data[2]).toBe(-100);
        });

        test('packet with f64 (large float)', () => {
            const original = new Packet(1);
            const value = 123456789.123456;
            original.add(value);
            const built = original.build();
            const loaded = new Packet();
            loaded.load(built.subarray(2));
            expect(loaded.data[0]).toBeCloseTo(value, 5);
        });

        test('packet with buffer data', () => {
            const original = new Packet(2);
            const buf = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
            original.add(buf);
            const built = original.build();
            const loaded = new Packet();
            loaded.load(built.subarray(2));
            expect(Buffer.isBuffer(loaded.data[0])).toBe(true);
            expect(Buffer.compare(loaded.data[0], buf)).toBe(0);
        });
    });

    describe('build format', () => {
        test('starts with 2-byte LE size', () => {
            const packet = new Packet(1);
            const built = packet.build();
            const size = built.readUInt16LE(0);
            // size should be 2 (netId only, no data)
            expect(size).toBe(2);
        });

        test('second 2 bytes are netId LE', () => {
            const packet = new Packet(0x1234);
            const built = packet.build();
            const netId = built.readUInt16LE(2);
            expect(netId).toBe(0x1234);
        });

        test('total buffer length = 2 (size field) + size value', () => {
            const packet = new Packet(1);
            packet.add(42);
            const built = packet.build();
            const size = built.readUInt16LE(0);
            expect(built.length).toBe(2 + size);
        });
    });

    describe('load edge cases', () => {
        test('handles empty buffer gracefully', () => {
            const packet = new Packet();
            packet.load(Buffer.alloc(0));
            expect(packet.data).toEqual([]);
        });

        test('handles buffer too short for netId', () => {
            const packet = new Packet();
            packet.load(Buffer.from([0x01]));
            expect(packet.data).toEqual([]);
        });

        test('handles netId-only buffer', () => {
            const packet = new Packet();
            packet.load(Buffer.from([0x05, 0x00]));
            expect(packet.netId).toBe(5);
            expect(packet.data).toEqual([]);
        });
    });
});
