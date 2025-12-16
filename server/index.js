import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

const clients = new Map();

function broadcast(message, excludeId = null) {
  const data = JSON.stringify(message);
  clients.forEach((client, id) => {
    if (id !== excludeId && client.readyState === 1) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substring(2, 9);
  clients.set(id, ws);
  
  ws.send(JSON.stringify({ 
    type: 'system', 
    content: `[SYSTEM] Connected. Your ID: ${id}`,
    timestamp: Date.now()
  }));
  
  broadcast({ 
    type: 'system', 
    content: `[SYSTEM] User ${id} joined the channel`,
    timestamp: Date.now()
  }, id);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'chat') {
        broadcast({
          type: 'chat',
          userId: id,
          username: msg.username || id,
          content: msg.content,
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    broadcast({ 
      type: 'system', 
      content: `[SYSTEM] User ${id} disconnected`,
      timestamp: Date.now()
    });
  });
});

console.log('WebSocket server running on ws://localhost:3001');
