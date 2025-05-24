import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Statistics from './pages/Statistics';
import Profile from './pages/Profile';
import CreateTournament from './pages/CreateTournament';
import Tournaments from './pages/Tournaments';
import TournamentDetails from './pages/TournamentDetails';
import NotFound from './pages/NotFound';
import { AudioProvider } from './contexts/AudioContext';
import RequireAuth from './components/auth/RequireAuth';

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-400"></div>
      </div>
    );
  }

  return (
    <AudioProvider>
      <div className="min-h-screen bg-green-900 text-stone-100 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/lobby/:code" element={
            <RequireAuth>
              <Lobby />
            </RequireAuth>
          } />
          <Route path="/game/:code" element={
            <RequireAuth>
              <Game />
            </RequireAuth>
          } />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/profile" element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          } />
          <Route path="/tournaments" element={
            <RequireAuth>
              <Tournaments />
            </RequireAuth>
          } />
          <Route path="/tournaments/create" element={
            <RequireAuth>
              <CreateTournament />
            </RequireAuth>
          } />
          <Route path="/tournaments/:id" element={
            <RequireAuth>
              <TournamentDetails />
            </RequireAuth>
          } />
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </div>
    </AudioProvider>
  );
}

export default App;