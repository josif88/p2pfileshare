require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*' }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

function getDeviceType(userAgent) {
    if (!userAgent) return 'desktop';
    const ua = userAgent.toLowerCase();
    if (/(android|webos|iphone|ipad|ipod|blackberry|windows phone)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

function getClientIp(socket) {
    let ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '';
    if (ip.includes('::ffff:')) {
        ip = ip.split('::ffff:')[1];
    }
    if (ip === '::1' || ip === '127.0.0.1') {
        ip = 'localhost';
    }
    return ip;
}

function buildPeerList() {
    const peers = [];
    for (let [id, socket] of io.sockets.sockets) {
        peers.push({
            id: socket.shortId,
            name: socket.funnyName,
            type: socket.deviceType,
            ip: socket.clientIp
        });
    }
    return peers;
}

io.on('connection', (socket) => {
    // Generate a short ID
    const shortId = socket.id.substring(0, 5);
    socket.shortId = shortId;

    // Generate a funny name
    const funnyName = uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
        length: 2
    });
    socket.funnyName = funnyName;

    // Detect device and IP
    socket.deviceType = getDeviceType(socket.handshake.headers['user-agent']);
    socket.clientIp = getClientIp(socket);

    // Send the client their own info
    socket.emit('your-id', { 
        id: shortId, 
        name: funnyName, 
        ip: socket.clientIp, 
        type: socket.deviceType 
    });

    // Broadcast updated peer list to everyone
    io.emit('peer-list', buildPeerList());
    console.log(`Peer connected: ${shortId} (${funnyName}) - ${socket.deviceType} [${socket.clientIp}]`);

    // Relay WebRTC signals
    socket.on('signal', ({ target, signal }) => {
        for (let [, s] of io.sockets.sockets) {
            if (s.shortId === target) {
                s.emit('signal', { sender: shortId, signal });
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`Peer disconnected: ${shortId}`);
        io.emit('peer-list', buildPeerList());
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`P2P File Share server listening on http://0.0.0.0:${PORT}`);
});
