"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'gemini':
        return 'Google Gemini Online';
      case 'chatgpt':
        return 'OpenAI ChatGPT Online';
      case 'claude':
        return 'Anthropic Claude Online';
      case 'other':
        return 'Mock Local Online';
      default:
        return 'Google Gemini Online';
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:3001/logs/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  
  useEffect(() => {
    setSessionId(Math.random().toString(36).substring(2, 15) + '-' + Date.now());
    fetchSessions();
  }, []);

  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) return;

    setInput('');
    setLoading(true);

    const userMessage: Message = { role: 'user', text: trimmedInput };
    const currentHistory = [...messages];
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('http://localhost:3001/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedInput,
          messages: currentHistory,
          sessionId: sessionId,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      
      setMessages(prev => [...prev, { role: 'bot', text: '' }]);

      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith('data: ')) continue;

          const dataStr = cleanLine.substring(6);
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;
              
              setMessages(prev => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = {
                    role: 'bot',
                    text: accumulatedText,
                  };
                }
                return updated;
              });
            }
          } catch (err: any) {
            console.error('Failed to parse line:', err);
          }
        }
      }

      
      setTimeout(fetchSessions, 800);

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: `⚠️ Error: ${err.message || 'Unable to stream response from NestJS backend.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    setSessionId(Math.random().toString(36).substring(2, 15) + '-' + Date.now());
  };

  const handleSelectSession = async (sid: string) => {
    if (loading || sid === sessionId) return;
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/logs/sessions/${sid}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        setSessionId(sid);
      } else {
        console.error('Failed to load session history');
      }
    } catch (err) {
      console.error('Error loading session history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  
  const formatText = (text: string) => {
    let parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        return (
          <pre key={idx} className="code-block">
            <code>{code}</code>
          </pre>
        );
      }
      
      
      const inlineParts = part.split(/`([^`]+)`/g);
      const renderedInline = inlineParts.map((subPart, subIdx) => {
        if (subIdx % 2 === 1) {
          return <code key={subIdx} className="inline-code">{subPart}</code>;
        }
        return subPart.split('\n').map((line, lineIdx, array) => (
          <React.Fragment key={lineIdx}>
            {line}
            {lineIdx < array.length - 1 && <br />}
          </React.Fragment>
        ));
      });

      return <span key={idx}>{renderedInline}</span>;
    });
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', width: '100%' }}>
          <div className="brand">
            <div className="brand-logo"></div>
            <h1>Samvada</h1>
          </div>
          
          <button onClick={handleClearChat} className="new-chat-btn">
            <span className="btn-icon">＋</span> New Conversation
          </button>
          
          <div className="chat-history-section">
            <h2>Recent Chats</h2>
            <div className="sessions-list">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`session-item ${sessionId === session.id ? 'active' : ''}`}
                >
                  <span className="session-icon">💬</span>
                  <div className="session-info">
                    <div className="session-title">{session.title}</div>
                    <div className="session-time">
                      {new Date(session.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="no-sessions">No recent chats</div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-workspace">
        <header className="chat-header">
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            <span className="status-text">{getModelDisplayName(selectedModel)}</span>
          </div>
          <div className="header-nav">
            <Link href="/" className="nav-link active">Chat</Link>
            <Link href="/dashboard" className="nav-link">Dashboard</Link>
          </div>
        </header>

        <div className="chat-messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🔮</div>
              <h2>What would you like to explore today?</h2>
              <p>Choose a prompt template below or start typing your own query.</p>
              
              <div className="suggestion-grid">
                <button 
                  className="suggestion-chip" 
                  onClick={() => handleSuggestionClick("Explain quantum computing in simple terms.")}
                >
                  <span className="chip-emoji">⚛️</span> Explain Quantum Computing
                </button>
                <button 
                  className="suggestion-chip" 
                  onClick={() => handleSuggestionClick("Write a short, engaging poem about stargazing in winter.")}
                >
                  <span className="chip-emoji">✍️</span> Write a Winter Poem
                </button>
                <button 
                  className="suggestion-chip" 
                  onClick={() => handleSuggestionClick("Design a quick 10-minute morning workout routine for office workers.")}
                >
                  <span className="chip-emoji">🏃‍♂️</span> Quick Morning Workout
                </button>
                <button 
                  className="suggestion-chip" 
                  onClick={() => handleSuggestionClick("Provide a delicious 5-ingredient recipe for dinner.")}
                >
                  <span className="chip-emoji">🍳</span> Simple 5-Ingredient Dinner
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-meta">
                  {msg.role === 'user' ? 'You' : 'Samvada'}
                </div>
                <div className="message-bubble">
                  {formatText(msg.text)}
                </div>
              </div>
            ))
          )}

          {}
          {loading && (
            <div className="typing-indicator-container">
              <div className="bot-avatar-mini">🤖</div>
              <div className="typing-bubble">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {}
        <div className="chat-input-area">
          <div className="model-selector-container">
            <label htmlFor="model-select" className="model-select-label">Model:</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select-dropdown"
            >
              <option value="gemini">Google Gemini</option>
              <option value="chatgpt">OpenAI ChatGPT</option>
              <option value="claude">Anthropic Claude</option>
              <option value="other">Mock Local</option>
            </select>
          </div>
          <form onSubmit={handleSubmit} className="input-form">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Samvada something..."
              rows={1}
              required
            />
            <button type="submit" disabled={loading} className="send-btn">
              <svg viewBox="0 0 24 24" width="20" height="20" className="send-icon">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
