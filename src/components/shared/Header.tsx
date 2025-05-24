import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Volume2, VolumeX, TrendingUp, User, BookOpen, Crown, Award, Target, Menu, X as CloseIcon, Trophy } from 'lucide-react';
import { useAudio } from '../../contexts/AudioContext';

const Header: React.FC = () => {
  const { playerName, signOut } = useAuth();
  const { isMuted, toggleMute, playSound } = useAudio();
  const [showGuide, setShowGuide] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const handleToggleMute = () => {
    playSound('buttonClick');
    toggleMute();
  };
  
  const handleSignOut = () => {
    playSound('buttonClick');
    signOut();
  };

  const handleToggleGuide = () => {
    playSound('buttonClick');
    setShowGuide(!showGuide);
    setShowMobileMenu(false);
  };

  const handleToggleMobileMenu = () => {
    playSound('buttonClick');
    setShowMobileMenu(!showMobileMenu);
  };
  
  return (
    <>
      <header className="bg-green-800 shadow-md py-4 px-6 relative">
        <div className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-amber-400 flex items-center">
            <div className="mr-2 bg-amber-400 text-green-900 w-10 h-10 rounded-full flex items-center justify-center">
              S
            </div>
            <span className="hidden sm:inline">Sjaus</span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <button 
              onClick={handleToggleGuide}
              className="text-white hover:text-amber-300 transition-colors"
              title="Quick Guide"
            >
              <BookOpen size={20} />
            </button>

            {playerName && (
              <>
                <div 
                  className="text-gray-500 cursor-not-allowed"
                  title="Tournaments coming soon!"
                >
                  <Trophy size={20} />
                </div>
                
                <Link 
                  to="/statistics" 
                  className="text-white hover:text-amber-300 transition-colors"
                  onClick={() => playSound('buttonClick')}
                >
                  <TrendingUp size={20} />
                </Link>
                
                <Link 
                  to="/profile" 
                  className="text-white hover:text-amber-300 transition-colors"
                  onClick={() => playSound('buttonClick')}
                >
                  <User size={20} />
                </Link>
                
                <button 
                  onClick={handleToggleMute}
                  className="text-white hover:text-amber-300 transition-colors"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                
                <div className="text-white px-3 py-1 bg-green-700 rounded-md">
                  {playerName}
                </div>
                
                <button 
                  onClick={handleSignOut}
                  className="text-white hover:text-amber-300 transition-colors"
                >
                  <LogOut size={20} />
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={handleToggleMobileMenu}
            className="md:hidden text-white hover:text-amber-300 transition-colors"
          >
            {showMobileMenu ? <CloseIcon size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-green-800 border-t border-green-700 p-4 z-50">
            <div className="space-y-4">
              <button 
                onClick={handleToggleGuide}
                className="w-full flex items-center text-white hover:text-amber-300 transition-colors py-2"
              >
                <BookOpen size={20} className="mr-2" />
                Quick Guide
              </button>

              {playerName && (
                <>
                  <div 
                    className="w-full flex items-center text-gray-500 py-2"
                  >
                    <Trophy size={20} className="mr-2" />
                    Tournaments (Coming Soon)
                  </div>
                  
                  <Link 
                    to="/statistics" 
                    className="w-full flex items-center text-white hover:text-amber-300 transition-colors py-2"
                    onClick={() => {
                      playSound('buttonClick');
                      setShowMobileMenu(false);
                    }}
                  >
                    <TrendingUp size={20} className="mr-2" />
                    Statistics
                  </Link>
                  
                  <Link 
                    to="/profile" 
                    className="w-full flex items-center text-white hover:text-amber-300 transition-colors py-2"
                    onClick={() => {
                      playSound('buttonClick');
                      setShowMobileMenu(false);
                    }}
                  >
                    <User size={20} className="mr-2" />
                    Profile
                  </Link>
                  
                  <button 
                    onClick={() => {
                      handleToggleMute();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center text-white hover:text-amber-300 transition-colors py-2"
                  >
                    {isMuted ? <VolumeX size={20} className="mr-2" /> : <Volume2 size={20} className="mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  
                  <div className="w-full flex items-center text-white py-2">
                    <User size={20} className="mr-2" />
                    {playerName}
                  </div>
                  
                  <button 
                    onClick={() => {
                      handleSignOut();
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center text-white hover:text-amber-300 transition-colors py-2"
                  >
                    <LogOut size={20} className="mr-2" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Quick Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-green-800 rounded-lg p-4 sm:p-6 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-amber-300 mb-6">Quick Guide</h2>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-green-700/50 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                  <Crown className="text-amber-400 mr-2" size={20} />
                  Game Overview
                </h3>
                <ul className="space-y-2 text-green-100">
                  <li>• 4 players in 2 partnerships (partners sit opposite)</li>
                  <li>• 32-card deck (7 through Ace in all suits)</li>
                  <li>• Each player gets 8 cards</li>
                  <li>• Start with 24 points, count down to win</li>
                </ul>
              </div>
              
              <div className="bg-green-700/50 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                  <Award className="text-amber-400 mr-2" size={20} />
                  Special Cards
                </h3>
                <p className="text-green-100 mb-2">Permanent Trumps (in order):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-green-600/50 p-3 rounded-md">
                    <p className="text-white font-bold mb-1">Black Suits</p>
                    <ul className="text-green-100">
                      <li className="flex items-center">♣ Queen of Clubs (Highest)</li>
                      <li className="flex items-center">♠ Queen of Spades</li>
                      <li className="flex items-center">♣ Jack of Clubs</li>
                      <li className="flex items-center">♠ Jack of Spades</li>
                    </ul>
                  </div>
                  <div className="bg-green-600/50 p-3 rounded-md">
                    <p className="text-white font-bold mb-1">Red Suits</p>
                    <ul className="text-green-100">
                      <li className="flex items-center">♥ Jack of Hearts</li>
                      <li className="flex items-center">♦ Jack of Diamonds</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-700/50 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                  <Target className="text-amber-400 mr-2" size={20} />
                  Gameplay
                </h3>
                <div className="space-y-2 text-green-100">
                  <p>1. Players bid to declare trump suit (need 5+ cards)</p>
                  <p>2. Follow suit if possible, otherwise play any card</p>
                  <p>3. Permanent trumps always beat regular cards</p>
                  <p>4. Win tricks to reduce your score</p>
                  <p>5. First team to reach 0 points wins</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleGuide}
              className="mt-6 w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;