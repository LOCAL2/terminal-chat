import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import Pusher from 'pusher-js';
import './App.css';

interface Message {
  type: 'system' | 'chat';
  content: string;
  username?: string;
  timestamp: number;
}

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [username] = useState(() => 'anon_' + Math.random().toString(36).substring(2, 6));
  const [isConnected, setIsConnected] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });

    const channel = pusher.subscribe('chat-channel');

    pusher.connection.bind('connected', () => {
      setIsConnected(true);
      setMessages(prev => [...prev, {
        type: 'system',
        content: '[SYSTEM] Connection established...',
        timestamp: Date.now()
      }]);
    });

    pusher.connection.bind('disconnected', () => {
      setIsConnected(false);
      setMessages(prev => [...prev, {
        type: 'system',
        content: '[SYSTEM] Connection lost...',
        timestamp: Date.now()
      }]);
    });

    channel.bind('message', (data: Message) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe('chat-channel');
      pusher.disconnect();
    };
  }, []);


  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    try {
      await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          username,
          content: input
        })
      });
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-header">
        <span className="terminal-title">SECURE_CHANNEL_v2.1 {isConnected ? '[ONLINE]' : '[OFFLINE]'}</span>
        <div className="terminal-buttons">
          <span className="btn red"></span>
          <span className="btn yellow"></span>
          <span className="btn green"></span>
        </div>
      </div>
      
      <div className="terminal-body" ref={terminalRef}>
        <div className="ascii-art">
{`
 ██████╗██╗  ██╗ █████╗ ████████╗
██╔════╝██║  ██║██╔══██╗╚══██╔══╝
██║     ███████║███████║   ██║   
██║     ██╔══██║██╔══██║   ██║   
╚██████╗██║  ██║██║  ██║   ██║   
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   
`}
        </div>
        <p className="welcome-text">[SYSTEM] Welcome to Secure Terminal Chat</p>
        <p className="welcome-text">[SYSTEM] All messages are encrypted end-to-end</p>
        <p className="welcome-text">[SYSTEM] Your handle: {username}</p>
        <br />
        
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            {msg.type === 'system' ? (
              <span className="system-msg">{msg.content}</span>
            ) : (
              <>
                <span className="timestamp">[{formatTime(msg.timestamp)}]</span>
                <span className="username"> {msg.username}@terminal:</span>
                <span className="content"> {msg.content}</span>
              </>
            )}
          </div>
        ))}
        
        <div className="input-line">
          <span className="prompt">{username}@secure:~$ </span>
          <span className="input-wrapper">
            <span className="input-mirror">{input}</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="terminal-input"
              autoFocus
              spellCheck={false}
            />
          </span>
          <span className="cursor">█</span>
        </div>
      </div>
    </div>
  );
}

export default App;
