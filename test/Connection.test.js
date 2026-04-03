const Connection = require('../src/network/Connection');
const Packet = require('../src/network/Packet');

describe('Connection', () => {
    function mockWs() {
        return { send: jest.fn(), close: jest.fn() };
    }

    function mockServer() {
        return { broadcast: jest.fn() };
    }

    describe('constructor', () => {
        test('stores ws and server references', () => {
            const ws = mockWs();
            const server = mockServer();
            const conn = new Connection(ws, server);
            expect(conn.ws).toBe(ws);
            expect(conn.server).toBe(server);
            expect(conn.code).toBeNull();
            expect(conn.message).toBeNull();
        });
    });

    describe('send', () => {
        test('builds and sends a Packet', () => {
            const ws = mockWs();
            const conn = new Connection(ws, mockServer());
            const packet = new Packet(1);
            packet.add(42);
            conn.send(packet);
            expect(ws.send).toHaveBeenCalledTimes(1);
            const sent = ws.send.mock.calls[0][0];
            expect(Buffer.isBuffer(sent)).toBe(true);
        });

        test('sends raw Buffer without rebuilding', () => {
            const ws = mockWs();
            const conn = new Connection(ws, mockServer());
            const raw = Buffer.from([1, 2, 3]);
            conn.send(raw);
            expect(ws.send).toHaveBeenCalledWith(raw);
        });

        test('emits error on ws.send failure', () => {
            const ws = { send: jest.fn(() => { throw new Error('fail'); }) };
            const conn = new Connection(ws, mockServer());
            const errors = [];
            conn.on('error', (e) => errors.push(e));
            const spy = jest.spyOn(console, 'error').mockImplementation();
            conn.send(Buffer.from([1]));
            expect(errors.length).toBe(1);
            expect(errors[0].message).toBe('fail');
            spy.mockRestore();
        });
    });

    describe('broadcast', () => {
        test('delegates to server.broadcast excluding self', () => {
            const server = mockServer();
            const conn = new Connection(mockWs(), server);
            const packet = new Packet(1);
            conn.broadcast(packet);
            expect(server.broadcast).toHaveBeenCalledWith(packet, conn);
        });
    });

    describe('kick', () => {
        test('closes the websocket', () => {
            const ws = mockWs();
            const conn = new Connection(ws, mockServer());
            conn.kick();
            expect(ws.close).toHaveBeenCalled();
        });
    });
});
