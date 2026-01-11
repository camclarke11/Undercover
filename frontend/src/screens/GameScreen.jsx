import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function GameScreen() {
  const { room, eliminatePlayer, skipElimination, mrWhiteGuess, eliminationResult, clearEliminationResult } = useSocket();
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const alivePlayers = room?.players?.filter(p => p.isAlive) || [];
  const speakingOrder = room?.speakingOrder || [];
  const mrWhitePlayer = room?.mrWhiteGuesserId 
    ? room.players.find(p => p.id === room.mrWhiteGuesserId)
    : null;

  useEffect(() => {
    if (eliminationResult) {
      setShowResult(true);
    }
  }, [eliminationResult]);

  const handleEliminate = async (playerId) => {
    if (loading) return;

    setLoading(true);
    try {
      await eliminatePlayer(playerId);
    } catch (err) {
      console.error('Failed to eliminate:', err);
    }
    setLoading(false);
  };

  const handleSkip = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await skipElimination();
    } catch (err) {
      console.error('Failed to skip:', err);
    }
    setLoading(false);
  };

  const handleMrWhiteGuess = async (e) => {
    e.preventDefault();
    if (!guess.trim() || loading) return;

    setLoading(true);
    try {
      await mrWhiteGuess(guess.trim());
    } catch (err) {
      console.error('Failed to submit guess:', err);
    }
    setLoading(false);
  };

  const handleContinue = () => {
    setShowResult(false);
    clearEliminationResult();
  };

  // Elimination Result Modal
  if (showResult && eliminationResult) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center w-full max-w-sm animate-fade-in">
          {eliminationResult.skipped ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-warning bg-opacity-20 flex items-center justify-center">
                <span className="text-3xl">⚖️</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Tie Vote!</h2>
              <p className="text-gray-400 mb-6">No one was eliminated. Moving to next round.</p>
            </>
          ) : eliminationResult.mrWhiteChance ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-warning bg-opacity-20 flex items-center justify-center">
                <span className="text-3xl">🎭</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">{eliminationResult.eliminated?.name} is out!</h2>
              <p className="text-game-warning mb-2">They were Mr. White!</p>
              <p className="text-gray-400 mb-6">Pass the phone to them for their final guess...</p>
            </>
          ) : eliminationResult.mrWhiteWrong ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-highlight bg-opacity-20 flex items-center justify-center">
                <span className="text-3xl">❌</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">Wrong Guess!</h2>
              <p className="text-gray-400 mb-2">Mr. White guessed: "{eliminationResult.guess}"</p>
              <p className="text-gray-400 mb-6">The game continues...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-highlight bg-opacity-20 flex items-center justify-center">
                <span className="text-3xl">💀</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">{eliminationResult.eliminated?.name} is out!</h2>
              <p className={`mb-6 ${eliminationResult.eliminated?.role === 'Civilian' ? 'text-game-success' : 'text-game-highlight'}`}>
                They were {eliminationResult.eliminated?.role === 'Civilian' ? 'a Civilian' : eliminationResult.eliminated?.role}!
              </p>
            </>
          )}
          <button onClick={handleContinue} className="btn-primary">
            {eliminationResult.mrWhiteChance ? 'Continue to Guess' : 'Next Round'}
          </button>
        </div>
      </div>
    );
  }

  // Mr. White Guessing Phase
  if (room?.status === 'MR_WHITE_GUESS') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <div className="card text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-warning bg-opacity-20 flex items-center justify-center">
            <span className="text-3xl">🎭</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Mr. White's Last Chance!</h2>
          <p className="text-game-warning text-lg mb-2">{mrWhitePlayer?.name}</p>
          <p className="text-gray-400 text-sm">
            Guess the Civilian word to win!
          </p>
        </div>

        <div className="card mb-6 bg-game-accent">
          <p className="text-sm text-gray-300 text-center">
            🔒 Only {mrWhitePlayer?.name} should see this screen
          </p>
        </div>

        <form onSubmit={handleMrWhiteGuess} className="mt-auto">
          <input
            type="text"
            placeholder="Enter your guess..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="input-field mb-4"
            autoComplete="off"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !guess.trim()}
            className="btn-primary"
          >
            {loading ? 'Submitting...' : 'Submit Guess'}
          </button>
        </form>
      </div>
    );
  }

  // Main Game Screen (PLAYING status)
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold mb-1">Round {room?.round}</h2>
        <p className="text-gray-400 text-sm">{alivePlayers.length} players remaining</p>
      </div>

      {/* Speaking Order */}
      <div className="card mb-4">
        <p className="text-sm text-gray-400 mb-3 text-center">🗣️ Speaking Order</p>
        <div className="space-y-2">
          {speakingOrder.map((player, idx) => (
            <div 
              key={player.id}
              className="flex items-center gap-3 py-2 px-3 bg-game-accent rounded-lg"
            >
              <div className="w-7 h-7 rounded-full bg-game-highlight flex items-center justify-center text-sm font-bold">
                {idx + 1}
              </div>
              <span className="font-medium text-white">{player.name}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          Each player says ONE word about their secret word
        </p>
      </div>

      {/* Voting Section */}
      <div className="card flex-1 mb-4">
        <p className="text-sm text-gray-400 mb-3 text-center">🗳️ Who was voted out?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {alivePlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => handleEliminate(player.id)}
              disabled={loading}
              className="flex flex-col items-center gap-2 p-3 bg-game-accent rounded-xl border border-transparent hover:border-game-highlight transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-game-highlight flex items-center justify-center text-lg font-bold">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-sm text-white truncate w-full text-center">{player.name}</span>
              <span className="text-game-highlight text-xs">Eliminate</span>
            </button>
          ))}
        </div>
      </div>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        disabled={loading}
        className="btn-secondary"
      >
        {loading ? 'Processing...' : 'Skip (Tie Vote)'}
      </button>
    </div>
  );
}
