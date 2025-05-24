import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../contexts/AudioContext';
import { User } from 'lucide-react';

const GuestLoginForm: React.FC = () => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { signInAsGuest } = useAuth();
  const { playSound } = useAudio();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    
    if (name.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }
    
    if (name.length > 20) {
      setError('Name must be less than 20 characters');
      return;
    }
    
    playSound('buttonClick');
    
    try {
      const { success, error } = await signInAsGuest(name);
      
      if (!success && error) {
        setError('Failed to login as guest');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg text-green-950">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-green-800 rounded-full flex items-center justify-center">
          <User size={32} className="text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-center mb-6">Play as Guest</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="guestName" className="block text-sm font-medium mb-2">
            Your Name
          </label>
          <input
            id="guestName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter your name"
            required
          />
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          className="w-full py-3 px-4 bg-green-700 hover:bg-green-800 text-white rounded-md font-medium transition-colors"
          onClick={() => playSound('buttonClick')}
        >
          Play Now
        </button>
      </form>
      
      <p className="mt-4 text-sm text-gray-600 text-center">
        Playing as a guest will not save your statistics long-term.
      </p>
    </div>
  );
};

export default GuestLoginForm;