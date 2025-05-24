import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import CreateJoinForm from '../components/home/CreateJoinForm';
import LobbyList from '../components/home/LobbyList';
import { useAuth } from '../hooks/useAuth';
import { useLobby } from '../hooks/useLobby';
import { useLobbies } from '../hooks/useLobbies';
import { LogIn, UserPlus } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

const Home: React.FC = () => {
  const { user, playerName } = useAuth();
  const { createLobby } = useLobby();
  const { lobbies, isLoading } = useLobbies();
  const navigate = useNavigate();
  const { playSound } = useAudio();
  
  const handleCreateLobby = async () => {
    await createLobby();
  };
  
  const handleAuthClick = (type: 'signin' | 'signup') => {
    playSound('buttonClick');
    navigate('/auth', { state: { isSignUp: type === 'signup' } });
  };
  
  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Header />
      
      <div className="flex-grow container mx-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-amber-400 mb-4">
              Sjaus Card Game
            </h1>
            <p className="text-lg sm:text-xl text-green-100">
              Experience the traditional Faroese trick-taking card game online with friends.
              A strategic partnership game where every card counts!
            </p>
          </div>
          
          <div className="bg-green-800 rounded-lg p-4 sm:p-6 shadow-lg">
            {user && playerName ? (
              <>
                <CreateJoinForm 
                  onCreateLobby={handleCreateLobby}
                />
                
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-amber-300 mb-4">Available Lobbies</h3>
                  {isLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400 mx-auto"></div>
                    </div>
                  ) : (
                    <LobbyList lobbies={lobbies} />
                  )}
                </div>
              </>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-amber-300 mb-6 text-center">
                  Join the Game
                </h2>
                
                <div className="space-y-4">
                  <button
                    onClick={() => handleAuthClick('signin')}
                    className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex items-center justify-center"
                  >
                    <LogIn size={22} className="mr-3" />
                    Sign In
                  </button>
                  
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-green-600"></div>
                    <span className="mx-4 text-green-300">OR</span>
                    <div className="flex-grow border-t border-green-600"></div>
                  </div>
                  
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center"
                  >
                    <UserPlus size={22} className="mr-3" />
                    Create Account
                  </button>
                </div>
                
                <p className="mt-6 text-sm text-green-300 text-center">
                  Sign in or create an account to play and track your statistics
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <footer className="bg-green-800 py-4 text-center text-green-200 text-sm mt-8">
        <div className="container mx-auto px-4">
          Sjaus Card Game &copy; 2025 - A Traditional Faroese Card Game
        </div>
      </footer>
    </div>
  );
};

export default Home;