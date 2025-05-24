import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { Home } from 'lucide-react';
import { useAudio } from '../contexts/AudioContext';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { playSound } = useAudio();
  
  const handleGoHome = () => {
    playSound('buttonClick');
    navigate('/');
  };
  
  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Header />
      
      <div className="flex-grow flex items-center justify-center p-6">
        <div className="bg-green-800 rounded-lg p-8 shadow-lg text-center max-w-md">
          <div className="text-9xl font-bold text-amber-400 mb-2">404</div>
          <h1 className="text-3xl font-bold text-white mb-4">Page Not Found</h1>
          <p className="text-green-100 mb-8">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <button
            onClick={handleGoHome}
            className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex items-center justify-center mx-auto"
          >
            <Home size={20} className="mr-2" />
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;