import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../types/auth';

interface ChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  currentUserId: string;
}

export const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, currentUserId }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="bg-bg-card rounded-lg p-4 flex flex-col h-96">
      <h3 className="text-text-primary font-bold mb-3">Chat</h3>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mb-3">
        {messages.length === 0 ? (
          <p className="text-text-secondary text-sm text-center italic">
            No messages yet
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col ${
                message.user_id === currentUserId ? 'items-end' : 'items-start'
              }`}
            >
              <span className="text-xs text-text-secondary mb-1">
                {message.username}
              </span>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  message.user_id === currentUserId
                    ? 'bg-accent text-white'
                    : 'bg-bg-darker text-text-primary'
                }`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-bg-darker text-text-primary rounded-lg px-4 py-2 border border-bg-darker focus:border-accent focus:outline-none text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-accent hover:bg-accent-hover text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};
