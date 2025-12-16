import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import Pusher from 'pusher-js';
import './App.css';

interface Message {
  type: 'system' | 'chat';
  content: string;
  username?: string;
  timestamp: number;
  id?: string;
}

interface TypingUser {
  username: string;
  text: string;
  timestamp: number;
}

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;
const API_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSettingName, setIsSettingName] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const myMessagesRef = useRef<Set<string>>(new Set());
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!username || isSettingName) return;

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
      if (data.id && myMessagesRef.current.has(data.id)) {
        myMessagesRef.current.delete(data.id);
        return;
      }
      // Clear typing indicator when message received
      if (data.username) {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(data.username!);
          return next;
        });
      }
      setMessages(prev => [...prev, data]);
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

    // Cleanup stale typing indicators
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
      pusher.unsubscribe('chat-channel');
      pusher.disconnect();
    };
  }, [username, isSettingName]);


  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isSettingName]);

  const sendTyping = async (text: string) => {
    try {
      await fetch(`${API_URL}/api/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, text })
      });
    } catch (error) {
      // Ignore typing errors
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    if (!isSettingName && username) {
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
          content: msgContent,
          id: msgId
        })
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isSettingName) {
        if (input.trim()) {
          setUsername(input.trim());
          setIsSettingName(false);
          setInput('');
        }
      } else {
        sendMessage();
      }
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  };

  const typingArray = Array.from(typingUsers.values());

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
        
        {isSettingName ? (
          <>
            <br />
            <div className="login-prompt">
              <p className="blink-text">{'>'} AUTHENTICATION REQUIRED {'<'}</p>
              <p className="welcome-text">[SYSTEM] Enter your handle to access the secure channel</p>
              <p className="welcome-text">[SYSTEM] Type your name and press ENTER</p>
            </div>
          </>
        ) : (
          <>
            <p className="welcome-text">[SYSTEM] Logged in as: {username}</p>
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
          <span className="prompt">{isSettingName ? 'guest' : username}@secure:~$ </span>
          <span className="input-wrapper">
            <span className="input-mirror">{input}</span>
            <input
              ref={inputRef}
              type="text"
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
