const Server = require('../src/network/Server');
const Client = require('../src/network/Client');
const Packet = require('../src/network/Packet');

const port = 3000;

const server = new Server();
const client = new Client();

const pingPacket = new Packet(1);
pingPacket.add('Ping');
const pongPacket = new Packet(1);
pongPacket.add('Pong');

server.on('ready', () => {  
    setTimeout(() => {
        client.connect('localhost', port);
    }, 1000);
});

client.on('connect', () => {
    console.log('Client connected');
    client.send(pingPacket);
});

client.on('disconnect', () => {
    console.log('Client disconnected');
});

client.on('packet', (packet) => {
    console.log('Client received packet: ' + packet.data);
    client.send(pingPacket);
});

server.on('connect', (connection) => {
    console.log('Server received connection');
});

server.on('disconnect', (ws, code, message) => {
    console.log('Server received disconnect');
});

server.on('packet', (connection, packet) => {
    console.log('Server received packet: ' + packet.data);
    connection.send(pongPacket);
});

server.listen(port);