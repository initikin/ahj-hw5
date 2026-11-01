import { randomUUID } from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import WebSocket, { WebSocketServer } from 'ws';

const app = express();
app.use(cors());
app.use(express.json());

const users = new Map();
const reservations = new Map();
const server = http.createServer(app);
const wsServer = new WebSocketServer({ server, maxPayload: 32 * 1024 });

function broadcast(data) {
  const message = JSON.stringify(data);
  for (const client of wsServer.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function removeUser(id) {
  clearTimeout(reservations.get(id));
  reservations.delete(id);
  if (users.delete(id)) broadcast([...users.values()]);
}

app.get('/', (request, response) => response.json({ status: 'ok' }));

app.post('/new-user', (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  if (!name || name.length > 40) {
    response.status(400).json({ status: 'error', message: 'Введите псевдоним до 40 символов.' });
    return;
  }
  if ([...users.values()].some((user) => user.name === name)) {
    response.status(409).json({ status: 'error', message: 'This name is already taken!' });
    return;
  }
  const user = { id: randomUUID(), name };
  users.set(user.id, user);
  // Освобождаем имя, если после регистрации WebSocket так и не подключился.
  reservations.set(user.id, setTimeout(() => removeUser(user.id), 30000));
  response.json({ status: 'ok', user });
});

wsServer.on('connection', (socket, request) => {
  const id = new URL(request.url, 'http://localhost').searchParams.get('id');
  const user = users.get(id);
  if (!user || [...wsServer.clients].some((client) => client !== socket && client.userId === id)) {
    socket.close(1008, 'Register first');
    return;
  }
  socket.userId = id;
  socket.isAlive = true;
  clearTimeout(reservations.get(id));
  reservations.delete(id);
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('error', () => socket.terminate());
  socket.on('close', () => removeUser(id));
  socket.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      socket.close(1007, 'Invalid JSON');
      return;
    }
    if (!data || !users.has(id)) return;
    if (data.type === 'exit') {
      removeUser(id);
      socket.close(1000, 'Bye');
      return;
    }
    if (data.type !== 'send' || typeof data.message !== 'string') return;
    const message = data.message.trim();
    if (!message || message.length > 4000) return;
    broadcast({ type: 'send', message, user, timestamp: new Date().toISOString() });
  });
  broadcast([...users.values()]);
});

const heartbeat = setInterval(() => {
  for (const socket of wsServer.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    if (socket.readyState === WebSocket.OPEN) socket.ping();
  }
}, 15000);
wsServer.on('close', () => clearInterval(heartbeat));

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Chat server: http://localhost:${port}`));
