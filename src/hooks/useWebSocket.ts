import { useState, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface WebSocketState {
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectAttempts: number;
}

export const useWebSocket = (channelName: string) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastHeartbeat: Date.now(),
    reconnectAttempts: 0,
  });

  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_DELAY = 1000;
  const MAX_DELAY = 30000;

  const connect = useCallback(() => {
    if (channel) {
      channel.unsubscribe();
    }

    const newChannel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: channelName },
      },
    });

    newChannel
      .on('presence', { event: 'sync' }, () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          reconnectAttempts: 0,
          lastHeartbeat: Date.now()
        }));
      })
      .on('presence', { event: 'join' }, () => {
        setState(prev => ({ ...prev, lastHeartbeat: Date.now() }));
      })
      .on('system', { event: 'heartbeat' }, () => {
        setState(prev => ({ ...prev, lastHeartbeat: Date.now() }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await newChannel.track({
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState(prev => {
            const newAttempts = prev.reconnectAttempts + 1;
            
            if (newAttempts >= MAX_RECONNECT_ATTEMPTS) {
              console.error('Max reconnection attempts reached');
              return { ...prev, isConnected: false };
            }

            // Exponential backoff with jitter
            const delay = Math.min(
              BASE_DELAY * Math.pow(2, newAttempts) + Math.random() * 1000,
              MAX_DELAY
            );

            setTimeout(connect, delay);

            return {
              ...prev,
              isConnected: false,
              reconnectAttempts: newAttempts,
            };
          });
        }
      });

    setChannel(newChannel);
  }, [channelName]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [connect]);

  // Heartbeat check
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - state.lastHeartbeat > 30000) { // 30 seconds
        setState(prev => ({
          ...prev,
          isConnected: false,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
        connect();
      }
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [state.lastHeartbeat, connect]);

  return {
    isConnected: state.isConnected,
    channel,
  };
};