```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { ChatMessage } from '../types/gameTypes';
import { useWebSocket } from './useWebSocket';

export const useChat = (lobbyId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playerName } = useAuth();
  const { channel, isConnected } = useWebSocket(`chat:${lobbyId}`);

  useEffect(() => {
    if (!lobbyId) return;
    fetchMessages();
  }, [lobbyId]);

  useEffect(() => {
    if (!channel) return;

    // Subscribe to chat events
    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        setMessages(prev => [...prev, payload as ChatMessage]);
      })
      .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
        setTypingUsers(prev => {
          if (!prev.includes(payload.player_name)) {
            return [...prev, payload.player_name];
          }
          return prev;
        });
      })
      .on('broadcast', { event: 'typing_end' }, ({ payload }) => {
        setTypingUsers(prev => prev.filter(name => name !== payload.player_name));
      });

    // Cleanup typing status after inactivity
    const cleanupInterval = setInterval(() => {
      const { data } = supabase
        .from('typing_status')
        .delete()
        .lt('last_typed', new Date(Date.now() - 10000).toISOString());
    }, 10000);

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [channel]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('lobby_id', lobbyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data as ChatMessage[]);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!playerName || !content.trim() || !isConnected) return;
    setError(null);

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      lobby_id: lobbyId,
      player_name: playerName,
      message: content.trim(),
      message_type: 'player',
      created_at: new Date().toISOString()
    };

    try {
      // Insert message into database
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          lobby_id: lobbyId,
          player_name: playerName,
          message: content.trim(),
          message_type: 'player'
        });

      if (insertError) throw insertError;

      // Broadcast message to other users
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMessage
        });
      }

      // Clear typing status
      await supabase
        .from('typing_status')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('player_name', playerName);

    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleTyping = async () => {
    if (!playerName || !isConnected) return;

    try {
      // Update typing status
      await supabase
        .from('typing_status')
        .upsert({
          lobby_id: lobbyId,
          player_name: playerName,
          is_typing: true,
          last_typed: new Date().toISOString()
        });

      // Broadcast typing status
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'typing_start',
          payload: { player_name: playerName }
        });
      }
    } catch (err) {
      console.error('Error updating typing status:', err);
    }
  };

  return {
    messages,
    typingUsers,
    isLoading,
    error,
    isConnected,
    sendMessage,
    handleTyping
  };
};
```