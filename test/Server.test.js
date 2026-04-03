const Server = require('../src/network/Server');
const Connection = require('../src/network/Connection');
const Packet = require('../src/network/Packet');
const Buffer = require('buffer').Buffer;

describe('Server', () => {
    describe('constructor', () => {
        test('initializes with empty connections', () => {
            const server = new Server();
            expect(server.connections.size).toBe(0);
            expect(server.server).toBeNull();
            expect(server.port).toBeNull();
        });
    });

    describe('handleConnect', () => {
        test('creates connection and emits connect event', () => {
            const server = new Server();
            const events = [];
            server.on('connect', (conn) => events.push(conn));
            const ws = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws);
            expect(server.connections.size).toBe(1);
            expect(events.length).toBe(1);
            expect(events[0]).toBeInstanceOf(Connection);
        });
    });

    describe('handleDisconnect', () => {
        test('removes connection and emits disconnect event', () => {
            const server = new Server();
            const ws = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws);
            const events = [];
            server.on('disconnect', (conn) => events.push(conn));
            server.handleDisconnect(ws, 1000, 'normal');
            expect(server.connections.size).toBe(0);
            expect(events.length).toBe(1);
            expect(events[0].code).toBe(1000);
        });

        test('does not crash for unknown websocket', () => {
            const server = new Server();
            expect(() => {
                server.handleDisconnect({}, 1000, 'unknown');
            }).not.toThrow();
        });
    });

    describe('handleData', () => {
        test('rejects non-binary data', () => {
            const server = new Server();
            const errors = [];
            server.on('error', (msg) => errors.push(msg));
            const spy = jest.spyOn(console, 'error').mockImplementation();
            server.handleData({}, 'text data', false);
            expect(errors.length).toBe(1);
            spy.mockRestore();
        });

        test('rejects data from unknown connection', () => {
            const server = new Server();
            const errors = [];
            server.on('error', (msg) => errors.push(msg));
            const spy = jest.spyOn(console, 'error').mockImplementation();
            const packet = new Packet(1);
            packet.add(42);
            server.handleData({}, packet.build(), true);
            expect(errors.length).toBe(1);
            spy.mockRestore();
        });

        test('parses valid binary packet', () => {
            const server = new Server();
            const ws = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws);

            const packets = [];
            server.on('packet', (conn, pkt) => packets.push({ conn, pkt }));

            const original = new Packet(5);
            original.add(99);
            server.handleData(ws, original.build(), true);

            expect(packets.length).toBe(1);
            expect(packets[0].pkt.netId).toBe(5);
            expect(packets[0].pkt.data[0]).toBe(99);
        });

        test('parses multiple concatenated packets', () => {
            const server = new Server();
            const ws = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws);

            const packets = [];
            server.on('packet', (conn, pkt) => packets.push(pkt));

            const p1 = new Packet(1);
            p1.add(10);
            const p2 = new Packet(2);
            p2.add(20);
            const combined = Buffer.concat([p1.build(), p2.build()]);
            server.handleData(ws, combined, true);

            expect(packets.length).toBe(2);
            expect(packets[0].netId).toBe(1);
            expect(packets[0].data[0]).toBe(10);
            expect(packets[1].netId).toBe(2);
            expect(packets[1].data[0]).toBe(20);
        });
    });

    describe('getConnectionByWebSocket', () => {
        test('finds existing connection', () => {
            const server = new Server();
            const ws = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws);
            const conn = server.getConnectionByWebSocket(ws);
            expect(conn).toBeInstanceOf(Connection);
            expect(conn.ws).toBe(ws);
        });

        test('returns null for unknown ws', () => {
            const server = new Server();
            expect(server.getConnectionByWebSocket({})).toBeNull();
        });
    });

    describe('broadcast', () => {
        test('sends to all connections', () => {
            const server = new Server();
            const ws1 = { send: jest.fn(), close: jest.fn() };
            const ws2 = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws1);
            server.handleConnect(ws2);

            const packet = new Packet(1);
            packet.add(42);
            server.broadcast(packet);

            expect(ws1.send).toHaveBeenCalledTimes(1);
            expect(ws2.send).toHaveBeenCalledTimes(1);
        });

        test('excludes specified connection', () => {
            const server = new Server();
            const ws1 = { send: jest.fn(), close: jest.fn() };
            const ws2 = { send: jest.fn(), close: jest.fn() };
            server.handleConnect(ws1);
            server.handleConnect(ws2);

            const conn1 = server.getConnectionByWebSocket(ws1);
            const packet = new Packet(1);
            packet.add(42);
            server.broadcast(packet, conn1);

            expect(ws1.send).not.toHaveBeenCalled();
            expect(ws2.send).toHaveBeenCalledTimes(1);
        });
    });
});
