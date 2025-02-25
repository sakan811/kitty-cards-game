import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Lobby from './components/Lobby';
import Game from './components/Game';
import { useGame } from './context/GameContext';

// Protected route component
const ProtectedGameRoute = () => {
  const { gameState } = useGame();
  
  if (!gameState.isPlaying || !gameState.roomCode) {
    console.log('Redirecting to lobby: Not in game state');
    return <Navigate to="/lobby" replace />;
  }
  
  return <Game />;
};

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4">
          <Routes>
            <Route path="/" element={<Navigate to="/lobby" replace />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/game" element={<ProtectedGameRoute />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App; 