```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Send, AlertCircle } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../contexts/AudioContext';

interface ChatBoxProps {
  lobbyId: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ lobbyId }) => {
  const [message, setMessage] = useState('');
  const { messages, typingUsers, sendMessage, isLoading, error, isConnected, handleTyping } = useChat(lobbyId);
  const { playerName } = useAuth();
  const { playSound } = useAudio();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollHeight, scrollTop, clientHeight } = chatContainerRef.current;
    const isScrolledToBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setAutoScroll(isScrolledToBottom);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !playerName || !isConnected) return;

    playSound('buttonClick');
    await sendMessage(message.trim());
    setMessage('');
    setAutoScroll(true);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    handleTyping();
    
    typingTimeoutRef.current = setTimeout(() => {
      // Typing ended
    }, 2000);
  };

  if (isLoading) {
    return (
      <div className="bg-green-800 rounded-lg p-4 shadow-lg h-[500px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-green-800 rounded-lg p-4 shadow-lg flex flex-col h-[500px]">
      <h2 className="text-xl font-bold text-amber-300 mb-4">Chat</h2>

      {!isConnected && (
        <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg flex items-center">
          <AlertCircle size={18} className="mr-2 flex-shrink-0" />
          <span className="text-sm">Reconnecting to chat...</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg flex items-center">
          <AlertCircle size={18} className="mr-2 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto mb-4 bg-green-700/50 rounded-lg p-4 scrollbar-thin scrollbar-thumb-green-600 scrollbar-track-transparent"
      >
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-green-300 italic">
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg animate-fadeIn ${
                  msg.message_type === 'system'
                    ? 'bg-amber-600/20 text-amber-300'
                    : msg.player_name === playerName
                    ? 'bg-green-600'
                    : 'bg-green-700'
                }`}
              >
                {msg.message_type === 'system' ? (
                  <div className="text-sm">
                    <span className="font-medium">System:</span> {msg.message}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-amber-300 mb-1">
                      {msg.player_name}
                    </div>
                    <div className="text-white break-words">{msg.message}</div>
                  </>
                )}
              </div>
            ))
          )}
          {typingUsers.length > 0 && (
            <div className="text-sm text-green-400 italic animate-pulse">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={handleMessageChange}
          placeholder="Type a message..."
          className="flex-1 bg-green-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-green-400"
          maxLength={200}
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={!message.trim() || !isConnected}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
```