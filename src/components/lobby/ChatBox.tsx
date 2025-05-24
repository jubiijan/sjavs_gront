import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { ChatMessage } from '../../types/gameTypes';
import { useChat } from '../../hooks/useChat';
import { useAudio } from '../../contexts/AudioContext';

interface ChatBoxProps {
  lobbyId: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ lobbyId }) => {
  const { messages, sendMessage } = useChat(lobbyId);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { playSound } = useAudio();
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
    
    // Play sound for new message, but not on initial load
    if (messages.length > 0 && document.hasFocus()) {
      playSound('chat');
    }
  }, [messages.length]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
      playSound('buttonClick');
    }
  };
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg flex flex-col h-full">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Chat</h2>
      
      <div className="flex-grow overflow-y-auto mb-4 bg-green-700/50 rounded-md p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-green-300 italic">
              No messages yet. Say hello!
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="animate-fadeIn">
                {message.message_type === 'system' ? (
                  <div className="bg-amber-800/30 rounded-md p-2 text-amber-300 text-sm">
                    <span className="font-medium">System: </span>
                    {message.message}
                  </div>
                ) : (
                  <div className="bg-green-700 rounded-md p-2">
                    <div className="text-amber-400 font-medium text-sm mb-1">
                      {message.player_name}:
                    </div>
                    <div className="text-white">
                      {message.message}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-grow p-3 bg-green-700 text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-green-300"
          maxLength={200}
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-600 text-white p-3 rounded-r-md transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;