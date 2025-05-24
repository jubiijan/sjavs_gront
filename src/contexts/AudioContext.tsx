import React, { createContext, useContext, useState, useEffect } from 'react';

type SoundType = 
  | 'cardPlace' 
  | 'cardSlide' 
  | 'dealCards'
  | 'shuffle'
  | 'trickWon'
  | 'victory'
  | 'buttonClick'
  | 'notification'
  | 'chat';

interface AudioContextType {
  playSound: (sound: SoundType) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

const AudioContext = createContext<AudioContextType>({
  playSound: () => {},
  isMuted: false,
  toggleMute: () => {},
});

export const useAudio = () => useContext(AudioContext);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('sjaus-muted');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sjaus-muted', JSON.stringify(isMuted));
  }, [isMuted]);

  const playSound = (sound: SoundType) => {
    // Sound playback removed but interface maintained for future use
    if (isMuted) return;
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  return (
    <AudioContext.Provider value={{ playSound, isMuted, toggleMute }}>
      {children}
    </AudioContext.Provider>
  );
};