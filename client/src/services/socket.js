// client/src/services/socket.js

import { io } from "socket.io-client";

let SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

// Local development fallback
if (!SOCKET_URL) {
  const host = window.location.hostname;

  SOCKET_URL =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
      ? `http://${host}:5000`
      : window.location.origin;
}

console.log("Connecting to Socket.IO Server:", SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"],

  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,

  timeout: 20000,

  autoConnect: false,
});

export default socket;