const socket = io();

// UI Elements
const myNameEl = document.getElementById('my-name');
const myIpEl = document.getElementById('my-ip');
const myIdEl = document.getElementById('my-id');
const peersListEl = document.getElementById('peers-list');
const connCard = document.getElementById('connection-card');
const connTitle = document.getElementById('conn-title');
const btnDisconnect = document.getElementById('btn-disconnect');
const fileSelectSection = document.getElementById('file-select-section');
const progressSection = document.getElementById('progress-section');
const fileInput = document.getElementById('file-input');
const fileDropArea = document.getElementById('file-drop-area');
const selectedFilesList = document.getElementById('selected-files-list');
const sendActionArea = document.getElementById('send-action-area');
const btnSendFile = document.getElementById('btn-send-file');
const transferStatus = document.getElementById('transfer-status');
const transferSpeed = document.getElementById('transfer-speed');
const progressBar = document.getElementById('progress-bar');
const transferAmount = document.getElementById('transfer-amount');
const transferPercentage = document.getElementById('transfer-percentage');
const downloadSection = document.getElementById('download-section');
const downloadLink = document.getElementById('download-link');

// State
let myId = '';
let targetPeerId = null;
let targetPeerName = '';
let peerConnection = null;
let dataChannel = null;

let selectedFiles = [];
let isSending = false;

// Receive State
let receiveBuffer = [];
let receivedSize = 0;
let incomingFileInfo = null;

// Speed calculation
let speedInterval = null;
let bytesSentLastTick = 0;
let bytesReceivedLastTick = 0;
let lastTickTime = 0;

// Config
const CHUNK_SIZE = 64 * 1024; // 64 KB
const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB

// --- Socket Events ---
socket.on('your-id', (data) => {
    myId = data.id;
    myNameEl.textContent = data.name;
    myIpEl.textContent = data.ip;
    myIdEl.textContent = data.id;
});

socket.on('peer-list', (peers) => {
    peersListEl.innerHTML = '';
    const otherPeers = peers.filter(p => p.id !== myId);

    if (otherPeers.length === 0) {
        peersListEl.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">Waiting for peers...</p>';
        return;
    }

    otherPeers.forEach(peer => {
        const btn = document.createElement('div');
        btn.className = 'peer-btn';
        
        const icon = peer.type === 'mobile' ? '📱' : '🖥️';
        
        btn.innerHTML = `
            <div class="peer-info">
                <span class="peer-name">${icon} ${peer.name}</span>
                <span class="peer-meta">${peer.ip} | ID: ${peer.id}</span>
            </div>
            <button class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">Connect</button>
        `;
        
        btn.querySelector('button').onclick = () => initiateConnection(peer.id, peer.name);
        peersListEl.appendChild(btn);
    });
});

socket.on('signal', async ({ sender, signal }) => {
    if (signal.type === 'offer') {
        targetPeerId = sender;
        await setupWebRTC();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { target: sender, signal: peerConnection.localDescription });
    } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal));
        } catch (e) {
            console.error('Error adding ICE candidate', e);
        }
    }
});

// --- WebRTC Setup ---
async function setupWebRTC() {
    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { target: targetPeerId, signal: event.candidate });
        }
    };

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            disconnect();
        }
    };
}

function setupDataChannel() {
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onopen = () => {
        showConnectionCard();
    };

    dataChannel.onclose = () => {
        disconnect();
    };

    dataChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            if (msg.type === 'file-meta') {
                incomingFileInfo = msg.meta;
                receiveBuffer = [];
                receivedSize = 0;
                showProgressSection(true);
                transferStatus.textContent = 'Receiving File...';
                startSpeedTracker(false);
            } else if (msg.type === 'file-done') {
                finishReceive();
            }
        } else {
            // Binary chunk
            receiveBuffer.push(event.data);
            receivedSize += event.data.byteLength;
            bytesReceivedLastTick += event.data.byteLength;
            updateProgress(receivedSize, incomingFileInfo.size);
        }
    };
}

async function initiateConnection(peerId, peerName) {
    targetPeerId = peerId;
    targetPeerName = peerName;
    connTitle.textContent = `Connecting to ${peerName}...`;
    showConnectionCard();
    
    await setupWebRTC();
    
    // Create reliable data channel for file transfer
    dataChannel = peerConnection.createDataChannel('fileTransfer', { ordered: true });
    setupDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { target: targetPeerId, signal: peerConnection.localDescription });
}

function disconnect() {
    if (peerConnection) {
        peerConnection.close();
    }
    peerConnection = null;
    dataChannel = null;
    targetPeerId = null;
    
    connCard.style.display = 'none';
    fileSelectSection.style.display = 'block';
    progressSection.style.display = 'none';
    downloadSection.style.display = 'none';
    selectedFiles = [];
    if (selectedFilesList) {
        selectedFilesList.style.display = 'none';
        sendActionArea.style.display = 'none';
    }
    fileInput.value = '';
    stopSpeedTracker();
}

btnDisconnect.onclick = disconnect;

// --- UI Helpers ---
function showConnectionCard() {
    connTitle.textContent = `Connected to Peer (ID: ${targetPeerId})`;
    connCard.style.display = 'block';
}

function showProgressSection(isReceiving = false) {
    fileSelectSection.style.display = 'none';
    progressSection.style.display = 'block';
    downloadSection.style.display = 'none';
    progressBar.style.width = '0%';
    transferSpeed.textContent = '0 MB/s';
    transferStatus.style.color = 'inherit';
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function updateProgress(current, total) {
    const percent = Math.min((current / total) * 100, 100);
    progressBar.style.width = percent + '%';
    transferPercentage.textContent = Math.round(percent) + '%';
    transferAmount.textContent = `${formatBytes(current)} / ${formatBytes(total)}`;
}

// --- Speed Tracking ---
function startSpeedTracker(isSender) {
    lastTickTime = performance.now();
    bytesSentLastTick = 0;
    bytesReceivedLastTick = 0;
    
    speedInterval = setInterval(() => {
        const now = performance.now();
        const deltaSec = (now - lastTickTime) / 1000;
        lastTickTime = now;
        
        let bytesDelta = isSender ? bytesSentLastTick : bytesReceivedLastTick;
        if (isSender) bytesSentLastTick = 0;
        else bytesReceivedLastTick = 0;
        
        const bytesPerSec = bytesDelta / deltaSec;
        transferSpeed.textContent = formatBytes(bytesPerSec) + '/s';
    }, 500);
}

function stopSpeedTracker() {
    if (speedInterval) {
        clearInterval(speedInterval);
        speedInterval = null;
    }
}

// --- File Handling ---
function handleFileSelect(files) {
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
        selectedFiles.push(files[i]);
    }
    
    renderSelectedFiles();
}

function renderSelectedFiles() {
    selectedFilesList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        selectedFilesList.style.display = 'none';
        sendActionArea.style.display = 'none';
        return;
    }
    
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem';
        item.style.backgroundColor = 'var(--bg)';
        item.style.border = '1px solid var(--border)';
        item.style.borderRadius = '4px';
        
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; min-width: 0;">
                <span class="font-mono" style="color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
                <span class="text-muted text-xs">${formatBytes(file.size)}</span>
            </div>
            <button class="btn btn-outline" style="padding: 0.25rem 0.5rem; border-color: var(--danger); color: var(--danger);" onclick="removeSelectedFile(${index})">X</button>
        `;
        selectedFilesList.appendChild(item);
    });
    
    selectedFilesList.style.display = 'flex';
    sendActionArea.style.display = 'block';
    
    btnSendFile.textContent = `Send ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`;
}

window.removeSelectedFile = function(index) {
    selectedFiles.splice(index, 1);
    renderSelectedFiles();
};

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files);
    }
});

fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.classList.add('dragover');
});

fileDropArea.addEventListener('dragleave', () => {
    fileDropArea.classList.remove('dragover');
});

fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
    }
});

// --- Sending Logic ---
btnSendFile.addEventListener('click', async () => {
    if (selectedFiles.length === 0 || !dataChannel || dataChannel.readyState !== 'open') return;

    fileSelectSection.style.display = 'none';
    progressSection.style.display = 'block';
    isSending = true;
    
    for (let i = 0; i < selectedFiles.length; i++) {
        if (!isSending) break;
        await sendFileAsync(selectedFiles[i], i + 1, selectedFiles.length);
    }
    
    if (isSending) {
        finishSendAll();
    }
});

function sendFileAsync(file, currentNum, totalNum) {
    return new Promise((resolve) => {
        transferStatus.textContent = `Sending File ${currentNum} of ${totalNum}...`;
        transferStatus.style.color = 'inherit';
        startSpeedTracker(true);

        dataChannel.send(JSON.stringify({
            type: 'file-meta',
            meta: {
                name: file.name,
                size: file.size,
                type: file.type
            }
        }));

        const fileReader = new FileReader();
        let offset = 0;
        let bytesSent = 0;

        dataChannel.bufferedAmountLowThreshold = BUFFER_THRESHOLD / 2;

        const readSlice = (o) => {
            const slice = file.slice(offset, o + CHUNK_SIZE);
            fileReader.readAsArrayBuffer(slice);
        };

        fileReader.addEventListener('load', (e) => {
            const buffer = e.target.result;
            
            if (dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
                const onLow = () => {
                    dataChannel.removeEventListener('bufferedamountlow', onLow);
                    sendBuffer(buffer);
                };
                dataChannel.addEventListener('bufferedamountlow', onLow);
            } else {
                sendBuffer(buffer);
            }
        });

        const sendBuffer = (buffer) => {
            try {
                if (!isSending) return resolve();
                
                dataChannel.send(buffer);
                offset += buffer.byteLength;
                bytesSent += buffer.byteLength;
                bytesSentLastTick += buffer.byteLength;
                
                updateProgress(bytesSent, file.size);

                if (offset < file.size) {
                    readSlice(offset);
                } else {
                    dataChannel.send(JSON.stringify({ type: 'file-done' }));
                    stopSpeedTracker();
                    resolve();
                }
            } catch (error) {
                console.error('Error sending data:', error);
                transferStatus.textContent = 'Error Sending';
                transferStatus.style.color = 'var(--danger)';
                stopSpeedTracker();
                resolve();
            }
        };

        readSlice(0);
    });
}

function finishSendAll() {
    isSending = false;
    transferStatus.textContent = 'All Files Sent Successfully!';
    transferStatus.style.color = 'var(--success)';
    transferSpeed.textContent = '';
    
    setTimeout(() => {
        fileSelectSection.style.display = 'block';
        progressSection.style.display = 'none';
        selectedFiles = [];
        renderSelectedFiles();
        fileInput.value = '';
        transferStatus.style.color = 'inherit';
    }, 3000);
}

// --- Receiving Logic ---
function finishReceive() {
    stopSpeedTracker();
    transferStatus.textContent = 'File Received!';
    transferStatus.style.color = 'var(--success)';
    transferSpeed.textContent = '';
    progressBar.style.width = '100%';

    const blob = new Blob(receiveBuffer, { type: incomingFileInfo.type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    // Auto-download using a temporary visible anchor (hidden anchors fail silently)
    const tempLink = document.createElement('a');
    tempLink.href = url;
    tempLink.download = incomingFileInfo.name;
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);

    // Also update the persistent download button as a fallback
    downloadLink.href = url;
    downloadLink.download = incomingFileInfo.name;
    downloadSection.style.display = 'block';
    
    // Keep UI clean, ready for next file
    setTimeout(() => {
        transferStatus.textContent = 'Waiting for next file...';
        transferStatus.style.color = 'inherit';
        progressBar.style.width = '0%';
        transferAmount.textContent = '0 / 0 MB';
        transferPercentage.textContent = '0%';
        downloadSection.style.display = 'none';
    }, 5000);

    receiveBuffer = [];
}
