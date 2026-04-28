# P2P File Send

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen.svg)

**[P2P File Send](https://p2pfilesend.com)** is a fast, secure, and zero-configuration peer-to-peer file sharing web application. It allows you to instantly transfer files directly between devices (phones, Smart TVs, laptops) without any cables, USB drives, or intermediate cloud storage.

🌍 **Live Website:** [p2pfilesend.com](https://p2pfilesend.com)

## ✨ Features

- **Zero-Configuration LAN Discovery:** Devices on the same Wi-Fi/Local Network automatically discover each other. Just open the app on both devices and click "Connect".
- **WAN Remote Connection:** Not on the same network? Generate a secure 6-digit Share Code or scan a QR code to establish a secure tunnel across the internet.
- **Direct P2P Transfer:** Files stream directly from Device A to Device B using WebRTC Data Channels. Your files never touch our servers.
- **Unlimited File Size:** Since there is no intermediary server storing the files, there are no artificial file size limits.
- **Bidirectional Sending:** Once connected, both devices can seamlessly send and receive files back and forth.
- **Privacy-First:** Fully end-to-end encrypted via standard WebRTC protocols.
- **Cross-Platform:** Works entirely in the browser. No apps to install. Send files between iOS, Android, Windows, macOS, and Smart TVs.

## 🚀 How It Works

Under the hood, this application uses:
- **Node.js & Express:** Serves the static front-end assets.
- **Socket.io:** Acts as a lightweight signaling server. It only handles the initial handshake (exchanging connection IDs and ICE candidates) and never touches the actual file data.
- **WebRTC:** Establishes a secure, direct, peer-to-peer connection for blazing-fast file transfers.
- **STUN/TURN:** Utilizes multiple STUN servers (including Google and Cloudflare) to ensure NAT traversal across different networks.

## 🛠️ Local Development & Self-Hosting

Want to run your own instance of P2P File Send? It's incredibly easy to set up.

### Prerequisites
- [Node.js](https://nodejs.org/) (v14 or higher recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/p2pfilesend.git
   cd p2pfilesend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000` (or `http://YOUR_LOCAL_IP:3000` to access it from other devices on your network).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is open-source and available under the MIT License.
