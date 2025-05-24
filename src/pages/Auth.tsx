import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../contexts/AudioContext';

const Auth: React.FC = () => {
  const location = useLocation();
  const initialIsSignUp = location.state?.isSignUp ?? false;
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const { playSound } = useAudio();
  const navigate = useNavigate();
  
  const from = location.state?.from?.pathname || '/';
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    playSound('buttonClick');
    
    try {
      if (isSignUp) {
        // Validate name
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
        
        // Validate email and password
        if (!email.trim()) {
          setError('Please enter an email address');
          return;
        }
        
        if (!password || password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        
        const { success, error: signUpError } = await signUp(email, password, name);
        if (!success) {
          // Handle specific error cases
          if (signUpError?.message?.includes('already registered')) {
            setError('This email is already registered. Please sign in instead.');
            return;
          }
          setError(signUpError?.message || 'Failed to create account');
          return;
        }
      } else {
        if (!email.trim() || !password) {
          setError('Please enter both email and password');
          return;
        }
        
        const { success, error: signInError } = await signIn(email, password);
        if (!success) {
          setError('Invalid email or password');
          return;
        }
      }
      
      // If we get here, authentication was successful
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Auth error:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };
  
  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
    playSound('buttonClick');
  };
  
  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-green-950">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isSignUp 
                ? 'Sign up to start playing Sjaus'
                : 'Sign in to continue playing'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Player Name
                </label>
                <div className="relative">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter your player name"
                  />
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter your email"
                  required
                />
                <Mail className="absolute right-3 top-3 text-gray-400" size={20} />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter your password"
                  minLength={6}
                  required
                />
                <Lock className="absolute right-3 top-3 text-gray-400" size={20} />
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full py-3 px-4 bg-green-700 hover:bg-green-800 text-white rounded-md font-medium transition-colors flex items-center justify-center"
            >
              {isSignUp ? (
                <>
                  <UserPlus size={20} className="mr-2" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn size={20} className="mr-2" />
                  Sign In
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-green-700 hover:text-green-800 font-medium"
            >
              {isSignUp 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;