import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import Landing from './screens/Landing';
import Lobby from './screens/Lobby';
import RoleReveal from './screens/RoleReveal';
import GameScreen from './screens/GameScreen';
import GameOver from './screens/GameOver';

function GameFlow() {
  const { room, gameResult } = useSocket();
  const [roleRevealComplete, setRoleRevealComplete] = useState(false);

  // Reset role reveal state when game ends or room resets
  useEffect(() => {
    if (!room || room.status === 'WAITING') {
      setRoleRevealComplete(false);
    }
  }, [room?.status]);

  // No room - show landing
  if (!room) {
    return <Landing />;
  }

  // Waiting for players - show lobby
  if (room.status === 'WAITING') {
    return <Lobby />;
  }

  // Game finished - show results
  if (room.status === 'FINISHED' || gameResult) {
    return <GameOver />;
  }

  // Role reveal phase
  if (room.status === 'ROLE_REVEAL' || (!roleRevealComplete && room.status === 'PLAYING')) {
    return <RoleReveal onReady={() => setRoleRevealComplete(true)} />;
  }

  // Game in progress (describing, voting, or Mr. White guessing)
  return <GameScreen />;
}

export default function App() {
  return (
    <SocketProvider>
      <div className="min-h-screen">
        <GameFlow />
      </div>
    </SocketProvider>
  );
}
