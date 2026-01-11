import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function RoleReveal({ onReady }) {
  const { room, revealRole } = useSocket();
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  const players = room?.players || [];
  const currentPlayer = players[currentPlayerIndex];
  const allRevealed = players.every(p => p.hasRevealed);

  // Auto-transition when room status changes to PLAYING (game started)
  useEffect(() => {
    if (room?.status === 'PLAYING') {
      onReady();
    }
  }, [room?.status, onReady]);

  // Skip already-revealed players when index changes
  useEffect(() => {
    if (currentPlayer?.hasRevealed && currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(currentPlayerIndex + 1);
      setRevealed(false);
    }
  }, [currentPlayerIndex, currentPlayer?.hasRevealed, players.length]);

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleNext = async () => {
    if (!currentPlayer) return;
    
    // If already revealed (shouldn't happen but just in case), just move to next
    if (currentPlayer.hasRevealed) {
      if (currentPlayerIndex < players.length - 1) {
        setCurrentPlayerIndex(currentPlayerIndex + 1);
        setRevealed(false);
      } else {
        onReady();
      }
      return;
    }

    setLoading(true);
    try {
      await revealRole(currentPlayer.id);
      
      // Move to next player if not the last one
      if (currentPlayerIndex < players.length - 1) {
        setCurrentPlayerIndex(currentPlayerIndex + 1);
        setRevealed(false);
      }
      // If it was the last player, the backend transitions to VOTING
      // and the useEffect above will call onReady()
    } catch (err) {
      console.error('Failed to mark reveal:', err);
      // If error, still try to move forward (might already be revealed)
      if (currentPlayerIndex < players.length - 1) {
        setCurrentPlayerIndex(currentPlayerIndex + 1);
        setRevealed(false);
      } else {
        onReady();
      }
    }
    setLoading(false);
  };

  const handleStartGame = () => {
    onReady();
  };

  const getRoleColor = (role) => {
    if (room?.settings?.hideRoleLabels && role !== 'Mr. White') return 'text-white';
    if (role === 'Civilian') return 'text-game-success';
    if (role === 'Undercover') return 'text-game-highlight';
    if (role === 'Mr. White') return 'text-game-warning';
    return 'text-white';
  };

  const getRoleEmoji = (role) => {
    if (room?.settings?.hideRoleLabels && role !== 'Mr. White') return '🤫';
    if (role === 'Civilian') return '👤';
    if (role === 'Undercover') return '🕵️';
    if (role === 'Mr. White') return '🎭';
    return '❓';
  };

  const getRoleInfo = (role) => {
    if (room?.settings?.hideRoleLabels && role !== 'Mr. White') {
      return 'Memorize your word! You don\'t know if you are a Civilian or Undercover.';
    }
    if (role === 'Civilian') {
      return 'Say a one-word clue about your word. Find the Undercover!';
    }
    if (role === 'Undercover') {
      return 'Your word is slightly different. Blend in with the Civilians!';
    }
    if (role === 'Mr. White') {
      return 'You have no word! Listen carefully and fake it. If caught, guess the word to win!';
    }
    return '';
  };

  // If all revealed, show ready screen
  if (allRevealed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center w-full max-w-sm animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-game-success bg-opacity-20 flex items-center justify-center">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Everyone's Ready!</h2>
          <p className="text-gray-400 mb-6">All players have seen their secret roles.</p>
          
          <button
            onClick={handleStartGame}
            className="btn-primary"
          >
            Start Voting
          </button>
        </div>
      </div>
    );
  }

  // If we've gone through all players (edge case)
  if (currentPlayerIndex >= players.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center w-full max-w-sm">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-accent" />
            <p className="text-gray-400">Starting game...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Progress indicator */}
      <div className="absolute top-6 left-0 right-0 px-6">
        <div className="flex justify-center gap-1.5">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className={`h-1.5 rounded-full transition-all ${
                p.hasRevealed
                  ? 'w-6 bg-game-success'
                  : idx === currentPlayerIndex
                  ? 'w-6 bg-game-highlight'
                  : 'w-3 bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {!revealed ? (
        <div className="text-center animate-fade-in">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-game-accent flex items-center justify-center">
              <svg className="w-16 h-16 text-game-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-2">{currentPlayer?.name}</h2>
            <p className="text-gray-400">Pass the phone to this player!</p>
            <p className="text-sm text-gray-500 mt-2">Make sure no one else is looking.</p>
          </div>

          <button
            onClick={handleReveal}
            className="btn-primary max-w-xs"
          >
            Tap to See Your Role
          </button>
        </div>
      ) : (
        <div className="text-center animate-fade-in w-full max-w-sm">
          <div className="text-sm text-gray-400 mb-4">{currentPlayer?.name}'s Secret</div>
          
          <div className="card mb-4">
            <div className="text-4xl mb-2">{getRoleEmoji(currentPlayer?.role)}</div>
            <p className="text-sm text-gray-400 mb-1">Your Role</p>
            <h2 className={`text-3xl font-bold ${getRoleColor(currentPlayer?.role)}`}>
              {room?.settings?.hideRoleLabels && currentPlayer?.role !== 'Mr. White' 
                ? '???' 
                : currentPlayer?.role}
            </h2>
          </div>

          <div className="card mb-4">
            <p className="text-sm text-gray-400 mb-1">Your Word</p>
            {currentPlayer?.word ? (
              <h2 className="text-4xl font-bold text-white">
                {currentPlayer.word}
              </h2>
            ) : (
              <div className="py-2">
                <span className="text-2xl text-gray-500">???</span>
                <p className="text-sm text-gray-400 mt-1">You have no word!</p>
              </div>
            )}
          </div>

          <div className="bg-game-accent rounded-xl p-4 mb-6 text-sm text-gray-300">
            {getRoleInfo(currentPlayer?.role)}
          </div>

          <button
            onClick={handleNext}
            disabled={loading}
            className="btn-primary"
          >
            {loading
              ? 'Saving...'
              : currentPlayerIndex < players.length - 1
              ? 'Got It! Next Player'
              : 'Got It! Start Game'
            }
          </button>
        </div>
      )}
    </div>
  );
}
