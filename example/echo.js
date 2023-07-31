const Server = require('../src/network/Server');
const Client = require('../src/network/Client');
const Packet = require('../src/network/Packet');

const port = 3000;

const server = new Server();
const client = new Client();

let i = 0;

server.on('ready', () => {
    client.connect('localhost', port);
    setInterval(() => {
        let packet = new Packet(1);
        packet.add(i++);
        client.send(packet);
    }, 1000);
});
server.on('connect', (connection) => {
    console.log('Server received connection');
});
server.on('disconnect', (ws, code, message) => {
    console.log('Server received disconnect');
});
server.on('packet', (connection, packet) => {
    console.log('Server received packet: ' + packet.data);
    connection.send(packet);
});

client.on('connect', () => {
    console.log('Client connected');
});
client.on('disconnect', () => {
    console.log('Client disconnected');
});
client.on('packet', (packet) => {
    console.log('Client received packet: ' + packet.data);
});

server.listen(port);
