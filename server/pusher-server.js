import express from 'express';
import cors from 'cors';
import Pusher from 'pusher';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

app.post('/api/chat', async (req, res) => {
  const { username, content, type, id } = req.body;

  try {
    await pusher.trigger('chat-channel', 'message', {
      type: type || 'chat',
      username,
      content,
      timestamp: Date.now(),
      id
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/typing', async (req, res) => {
  const { username, text } = req.body;

  try {
    await pusher.trigger('chat-channel', 'typing', {
      username,
      text
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send typing' });
  }
});

app.listen(3001, () => {
  console.log('Pusher API server running on http://localhost:3001');
});
