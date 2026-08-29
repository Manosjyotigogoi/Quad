import { io } from 'socket.io-client';
import { COOKIE_NAME } from './cookieName';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// Reads the httpOnly auth cookie... except it CAN'T read an httpOnly
// cookie from JavaScript (that's the whole point of httpOnly). So we
// fall back to letting Socket.io send the cookie automatically via
// withCredentials, and the backend's auth middleware parses it from
// the handshake's cookie header.
export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket'],
    autoConnect: false
  });

  socket.on('connect_error', (err) => {
    // Silent — the REST endpoints still work, this just means no
    // real-time delivery. The Messages page falls back to polling.
    if (import.meta.env.DEV) console.warn('[socket] connect error:', err.message);
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export { SOCKET_URL };
