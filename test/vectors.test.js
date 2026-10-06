// Runs gn.js against the shared protocol conformance vectors in
// test/vectors/protocol.json. Other ports (gn.hml, gn.c) run the same file.
const Buffer = require('buffer').Buffer;
const Packet = require('../src/network/Packet');
const Server = require('../src/network/Server');
const vectors = require('./vectors/protocol.json');

function special(v) {
    if (v === 'NaN') return NaN;
    if (v === 'Infinity') return Infinity;
    if (v === '-Infinity') return -Infinity;
    return v;
}

// encode-side value -> JS value
function toNative(x) {
    switch (x.t) {
        case 'int': return x.v;
        case 'float': return special(x.v);
        case 'bool': return x.v;
        case 'string': return x.repeat !== undefined ? x.repeat.repeat(x.count) : x.v;
        case 'buffer': return Buffer.from(x.hex, 'hex');
        case 'undefined': return undefined;
    }
    throw new Error('unknown value tag ' + x.t);
}

// decoded value -> expected JS value
function expected(d) {
    if (d.type === 'undefined') return undefined;
    if (d.type === 'buffer') return Buffer.from(d.hex, 'hex');
    return special(d.v);
}

function expectValues(actual, decoded) {
    expect(actual.length).toBe(decoded.length);
    decoded.forEach((d, i) => {
        const want = expected(d);
        if (Number.isNaN(want)) expect(actual[i]).toBeNaN();
        else if (Buffer.isBuffer(want)) expect(Buffer.compare(actual[i], want)).toBe(0);
        else expect(actual[i]).toBe(want);
    });
}

function load(hex) {
    const packet = new Packet();
    packet.load(Buffer.from(hex, 'hex'));
    return packet;
}

describe('protocol vectors: encode', () => {
    test.each(vectors.encode.map(v => [v.name, v]))('%s', (_, v) => {
        const packet = new Packet(v.netId);
        packet.add(v.values.map(toNative));
        expect(packet.build().toString('hex')).toBe(v.hex);
    });
});

describe('protocol vectors: encode errors', () => {
    test.each(vectors.encode_errors.map(v => [v.name, v]))('%s', (_, v) => {
        const packet = new Packet(v.netId);
        packet.add(v.values.map(toNative));
        expect(() => packet.build()).toThrow();
    });
});

describe('protocol vectors: decode', () => {
    test.each(vectors.decode.map(v => [v.name, v]))('%s', (_, v) => {
        const packet = load(v.payload);
        expect(packet.netId === undefined ? null : packet.netId).toBe(v.netId);
        expectValues(packet.data, v.values);
    });
});

describe('protocol vectors: frames', () => {
    test.each(vectors.frames.map(v => [v.name, v]))('%s', (_, v) => {
        const server = new Server();
        const ws = {};
        server.handleConnect(ws);
        const received = [];
        server.on('packet', (conn, packet) => received.push(packet));
        server.handleData(ws, Buffer.from(v.hex, 'hex'), true);

        expect(received.length).toBe(v.packets.length);
        v.packets.forEach((p, i) => {
            expect(received[i].netId).toBe(p.netId);
            expectValues(received[i].data, p.values);
        });
    });
});
