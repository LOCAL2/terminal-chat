import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import Pusher from 'pusher-js';
import { AlienText } from './AlienText';
import './App.css';

interface Message {
  type: 'system' | 'chat';
  content: string;
  username?: string;
  timestamp: number;
  id?: string;
  isAlien?: boolean;
  alienLength?: number;
}

interface TypingUser {
  username: string;
  text: string;
  timestamp: number;
}

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Simple XOR encryption with Unicode support
const encrypt = (text: string, key: string): string => {
  if (!key) return text;
  const encoded = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = encoded.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
  return btoa(String.fromCharCode(...result));
};

const decrypt = (encoded: string, key: string): string => {
  if (!key) return encoded;
  try {
    const decoded = atob(encoded);
    const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)));
    const keyBytes = new TextEncoder().encode(key);
    const result = bytes.map((byte, i) => byte ^ keyBytes[i % keyBytes.length]);
    return new TextDecoder().decode(result);
  } catch {
    return encoded;
  }
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [step, setStep] = useState<'name' | 'room' | 'chat'>('name');
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const myMessagesRef = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (step !== 'chat' || !room) return;

    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
    });

    // Subscribe to room-specific channel
    const channel = pusher.subscribe(`room-${room}`);

    pusher.connection.bind('connected', () => {
      setIsConnected(true);
      setMessages(prev => [...prev, {
        type: 'system',
        content: '[SYSTEM] Secure connection established...',
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
      if (data.id && myMessagesRef.current.has(data.id)) {
        myMessagesRef.current.delete(data.id);
        return;
      }
      if (data.username) {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(data.username!);
          return next;
        });
      }
      // Decrypt with room name as key
      let decrypted = '';
      let isAlien = true;
      try {
        decrypted = decrypt(data.content, secretKey);
        // Allow: ASCII printable + all Thai characters (U+0E00-U+0E7F)
        const validPattern = /^[\x20-\x7E\u0E00-\u0E7F]+$/;
        isAlien = !validPattern.test(decrypted) || decrypted.length === 0;
      } catch {
        isAlien = true;
      }
      setMessages(prev => [...prev, {
        ...data,
        content: isAlien ? '' : decrypted,
        isAlien,
        alienLength: Math.max(10, data.content.length)
      }]);
    });

    channel.bind('typing', (data: { username: string; text: string }) => {
      if (data.username === username) return;
      setTypingUsers(prev => {
        const next = new Map(prev);
        if (data.text) {
          next.set(data.username, { ...data, timestamp: Date.now() });
        } else {
          next.delete(data.username);
        }
        return next;
      });
    });

    const cleanupInterval = setInterval(() => {
      setTypingUsers(prev => {
        const next = new Map(prev);
        const now = Date.now();
        next.forEach((value, key) => {
          if (now - value.timestamp > 3000) next.delete(key);
        });
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(cleanupInterval);
      channel.unbind_all();
      pusher.unsubscribe(`room-${room}`);
      pusher.disconnect();
    };
  }, [step, room, secretKey, username]);


  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const sendTyping = async (text: string) => {
    try {
      await fetch(`${API_URL}/api/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, text, room })
      });
    } catch {
      // Ignore
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    if (step === 'chat' && username) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTyping(value ? 'typing' : '');
      typingTimeoutRef.current = window.setTimeout(() => {
        sendTyping('');
      }, 2000);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const msgId = Math.random().toString(36).substring(2, 9);
    const msgContent = input;
    const encrypted = encrypt(msgContent, secretKey);
    
    setMessages(prev => [...prev, {
      type: 'chat',
      username,
      content: msgContent,
      timestamp: Date.now(),
      id: msgId
    }]);
    myMessagesRef.current.add(msgId);
    setInput('');
    sendTyping('');
    
    try {
      await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          username,
          content: encrypted,
          id: msgId,
          room
        })
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      if (step === 'name') {
        setUsername(input.trim());
        setInput('');
        setStep('room');
      } else if (step === 'room') {
        const roomInput = input.trim();
        // Room name is also the encryption key
        setRoom(roomInput);
        setSecretKey(roomInput);
        setInput('');
        setStep('chat');
      } else {
        sendMessage();
      }
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  };

  const typingArray = Array.from(typingUsers.values());

  const getPromptText = () => {
    if (step === 'name') return 'guest';
    if (step === 'room') return username;
    return username;
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
        
        {step === 'name' && (
          <>
            <br />
            <div className="login-prompt">
              <p className="blink-text">{'>'} AUTHENTICATION REQUIRED {'<'}</p>
              <p className="welcome-text">[SYSTEM] Enter your handle to continue</p>
            </div>
          </>
        )}

        {step === 'room' && (
          <>
            <br />
            <div className="login-prompt">
              <p className="blink-text">{'>'} ROOM KEY REQUIRED {'<'}</p>
              <p className="welcome-text">[SYSTEM] Enter secret room key</p>
              <p className="welcome-text">[SYSTEM] Share this key with friends to chat</p>
              <p className="welcome-text">[SYSTEM] Wrong key = different room + alien text</p>
            </div>
          </>
        )}

        {step === 'chat' && (
          <>
            <p className="welcome-text">[SYSTEM] Logged in as: {username}</p>
            <p className="welcome-text">[SYSTEM] Room: [ENCRYPTED]</p>
            <br />
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.type}`}>
                {msg.type === 'system' ? (
                  <span className="system-msg">{msg.content}</span>
                ) : (
                  <>
                    <span className="timestamp">[{formatTime(msg.timestamp)}]</span>
                    <span className="username"> {msg.username}@terminal:</span>
                    <span className="content"> {msg.isAlien ? <AlienText length={msg.alienLength || 10} /> : msg.content}</span>
                  </>
                )}
              </div>
            ))}
            {typingArray.length > 0 && (
              <div className="typing-indicator">
                <span className="typing-text">
                  {typingArray.map(u => u.username).join(', ')} is typing
                </span>
                <span className="typing-dots">...</span>
              </div>
            )}
          </>
        )}
        
        <div className="input-line">
          <span className="prompt">{getPromptText()}@secure:~$ </span>
          <span className="input-wrapper">
            <span className="input-mirror">{step === 'room' ? '•'.repeat(input.length) : input}</span>
            <input
              ref={inputRef}
              type={step === 'room' ? 'password' : 'text'}
              value={input}
              onChange={handleInputChange}
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
