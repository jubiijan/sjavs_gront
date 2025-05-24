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
        setState(prev => ({ ...prev, isConnected: true, reconnectAttempts: 0 }));
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
          setState(prev => ({
            ...prev,
            isConnected: false,
            reconnectAttempts: prev.reconnectAttempts + 1,
          }));
          
          // Exponential backoff for reconnection
          const backoffTime = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 30000);
          setTimeout(connect, backoffTime);
        }
      });

    setChannel(newChannel);
  }, [channelName, state.reconnectAttempts]);

  // Heartbeat check
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - state.lastHeartbeat > 30000) { // 30 seconds
        connect(); // Reconnect if no heartbeat
      }
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [state.lastHeartbeat, connect]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [connect]);

  return {
    isConnected: state.isConnected,
    channel,
  };
};