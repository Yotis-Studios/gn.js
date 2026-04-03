const Client = require('../src/network/Client');

describe('Client', () => {
    describe('constructor', () => {
        test('initializes with null ws and disconnected', () => {
            const client = new Client();
            expect(client.ws).toBeNull();
            expect(client.connected).toBe(false);
        });
    });

    describe('disconnect', () => {
        test('does not throw when ws is null', () => {
            const client = new Client();
            expect(() => client.disconnect()).not.toThrow();
        });

        test('calls ws.close with code 1000', () => {
            const client = new Client();
            const mockClose = jest.fn();
            client.ws = { close: mockClose };
            client.disconnect();
            expect(mockClose).toHaveBeenCalledWith(1000, 'Client closed');
        });
    });

    describe('send', () => {
        test('logs error when ws is null', () => {
            const client = new Client();
            const spy = jest.spyOn(console, 'error').mockImplementation();
            client.send({ build: () => Buffer.from([]) });
            expect(spy).toHaveBeenCalledWith('Cannot send packet, WebSocket is null');
            spy.mockRestore();
        });

        test('logs error when ws is not open', () => {
            const client = new Client();
            client.ws = { readyState: 0 }; // CONNECTING
            const spy = jest.spyOn(console, 'error').mockImplementation();
            client.send({ build: () => Buffer.from([]) });
            expect(spy).toHaveBeenCalledWith('Cannot send packet, WebSocket is not open');
            spy.mockRestore();
        });
    });

    describe('isConnected', () => {
        test('returns connection state', () => {
            const client = new Client();
            expect(client.isConnected()).toBe(false);
            client.connected = true;
            expect(client.isConnected()).toBe(true);
        });
    });

    describe('getWebSocket', () => {
        test('returns the websocket', () => {
            const client = new Client();
            expect(client.getWebSocket()).toBeNull();
        });
    });
});
