import { useState, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface WebSocketState {
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectAttempts: number;
  lastError: string | null;
}

interface WebSocketOptions {
  maxReconnectAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

const DEFAULT_OPTIONS: WebSocketOptions = {
  maxReconnectAttempts: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  heartbeatInterval: 10000,
  heartbeatTimeout: 30000
};

export const useWebSocket = (channelName: string, options: WebSocketOptions = {}) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastHeartbeat: Date.now(),
    reconnectAttempts: 0,
    lastError: null
  });

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Track connection state
  const updateConnectionState = useCallback((connected: boolean, error?: string) => {
    setState(prev => ({
      ...prev,
      isConnected: connected,
      lastHeartbeat: connected ? Date.now() : prev.lastHeartbeat,
      reconnectAttempts: connected ? 0 : prev.reconnectAttempts,
      lastError: error || null
    }));
  }, []);

  // Calculate backoff delay
  const getBackoffDelay = useCallback(() => {
    const jitter = Math.random() * 1000;
    return Math.min(
      opts.baseDelay! * Math.pow(2, state.reconnectAttempts) + jitter,
      opts.maxDelay!
    );
  }, [state.reconnectAttempts, opts.baseDelay, opts.maxDelay]);

  // Connect to channel
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
        updateConnectionState(true);
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
          handleDisconnect('Connection lost');
        }
      });

    setChannel(newChannel);
  }, [channelName, updateConnectionState]);

  // Handle disconnection
  const handleDisconnect = useCallback((error?: string) => {
    setState(prev => {
      const newAttempts = prev.reconnectAttempts + 1;
      
      if (newAttempts >= opts.maxReconnectAttempts!) {
        return {
          ...prev,
          isConnected: false,
          lastError: 'Max reconnection attempts reached'
        };
      }

      setTimeout(connect, getBackoffDelay());

      return {
        ...prev,
        isConnected: false,
        reconnectAttempts: newAttempts,
        lastError: error || prev.lastError
      };
    });
  }, [connect, getBackoffDelay, opts.maxReconnectAttempts]);

  // Initial connection
  useEffect(() => {
    connect();
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [connect]);

  // Heartbeat monitoring
  useEffect(() => {
    const heartbeatInterval = setInterval(() => {
      const now = Date.now();
      if (now - state.lastHeartbeat > opts.heartbeatTimeout!) {
        handleDisconnect('Heartbeat timeout');
      }
    }, opts.heartbeatInterval);

    return () => clearInterval(heartbeatInterval);
  }, [state.lastHeartbeat, opts.heartbeatTimeout, opts.heartbeatInterval, handleDisconnect]);

  return {
    isConnected: state.isConnected,
    lastError: state.lastError,
    channel,
    reconnect: connect
  };
};