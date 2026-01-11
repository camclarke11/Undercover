import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function GameOver() {
  const { room, gameResult, playAgain, resetScores, leaveRoom } = useSocket();
  const [loading, setLoading] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const handlePlayAgain = async () => {
    setLoading(true);
    try {
      await playAgain();
    } catch (err) {
      console.error('Failed to reset room:', err);
    }
    setLoading(false);
  };

  const handleResetScores = async () => {
    try {
      await resetScores();
    } catch (err) {
      console.error('Failed to reset scores:', err);
    }
  };

  const handleLeave = () => {
    leaveRoom();
  };

  const getWinnerEmoji = () => {
    if (gameResult?.winners?.includes('Civilians')) return '🎉';
    if (gameResult?.winners?.includes('Mr. White')) return '🎭';
    return '🕵️';
  };

  const getWinnerColor = () => {
    if (gameResult?.winners?.includes('Civilians')) return 'text-game-success';
    return 'text-game-highlight';
  };

  const leaderboard = gameResult?.leaderboard || room?.leaderboard || [];
  const scoreResults = gameResult?.scoreResults || [];
  const gamesPlayed = room?.gamesPlayedTotal || 0;

  // Leaderboard View
  if (showLeaderboard) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setShowLeaderboard(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">🏆 Leaderboard</h1>
          <div className="w-6" />
        </div>

        <div className="card mb-4">
          <p className="text-center text-gray-400 text-sm mb-4">
            After {gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}
          </p>
          
          <div className="space-y-2">
            {leaderboard.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center justify-between py-3 px-4 rounded-xl ${
                  idx === 0 ? 'bg-game-warning bg-opacity-20 border border-game-warning' :
                  idx === 1 ? 'bg-gray-400 bg-opacity-10 border border-gray-400' :
                  idx === 2 ? 'bg-amber-700 bg-opacity-20 border border-amber-700' :
                  'bg-game-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${
                    idx === 0 ? 'bg-game-warning text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-amber-700 text-white' :
                    'bg-game-highlight text-white'
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{player.name}</p>
                    <p className="text-xs text-gray-400">
                      {player.gamesWon}W / {player.gamesPlayed}G
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-game-success">{player.score}</p>
                  <p className="text-xs text-gray-400">points</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleResetScores}
          className="btn-secondary mb-4"
        >
          Reset All Scores
        </button>

        <button
          onClick={() => setShowLeaderboard(false)}
          className="btn-primary"
        >
          Back to Results
        </button>
      </div>
    );
  }

  // Main Game Over View
  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm mx-auto text-center">
        {/* Win Banner */}
        <div className="mb-6 animate-fade-in">
          <div className="text-5xl mb-3">{getWinnerEmoji()}</div>
          <h1 className={`text-2xl font-bold mb-1 ${getWinnerColor()}`}>
            {gameResult?.winners?.join(' & ')} Win!
          </h1>
          <p className="text-gray-400 text-sm">{gameResult?.winReason}</p>
        </div>

        {/* Word Reveal */}
        <div className="card mb-4">
          <p className="text-xs text-gray-400 mb-2">The words were:</p>
          <div className="flex justify-center gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-game-success">{gameResult?.wordPair?.civ || room?.wordPair?.civ}</p>
              <p className="text-xs text-gray-400">Civilian</p>
            </div>
            <div className="text-xl text-gray-500">vs</div>
            <div className="text-center">
              <p className="text-lg font-bold text-game-highlight">{gameResult?.wordPair?.und || room?.wordPair?.und}</p>
              <p className="text-xs text-gray-400">Undercover</p>
            </div>
          </div>
          {(gameResult?.wordPair?.cat || room?.wordPair?.cat) && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Category: {gameResult?.wordPair?.cat || room?.wordPair?.cat}
            </p>
          )}
        </div>

        {/* Mr. White Guess */}
        {gameResult?.mrWhiteGuess && (
          <div className="card mb-4">
            <p className="text-xs text-gray-400 mb-1">Mr. White guessed:</p>
            <p className={`text-lg font-bold ${gameResult.mrWhiteCorrect ? 'text-game-success' : 'text-game-highlight'}`}>
              "{gameResult.mrWhiteGuess}" {gameResult.mrWhiteCorrect ? '✓' : '✗'}
            </p>
          </div>
        )}

        {/* Points This Game */}
        {scoreResults.length > 0 && (
          <div className="card mb-4">
            <p className="text-xs text-gray-400 mb-3">Points Earned</p>
            <div className="space-y-2">
              {scoreResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between py-2 px-3 bg-game-accent rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      result.role === 'Civilian' ? 'text-game-success' :
                      result.role === 'Undercover' ? 'text-game-highlight' :
                      'text-game-warning'
                    }`}>
                      {result.role === 'Civilian' ? '👤' : result.role === 'Undercover' ? '🕵️' : '🎭'}
                    </span>
                    <span className="text-white text-sm">{result.name}</span>
                  </div>
                  <div className="text-right">
                    {result.pointsThisGame > 0 ? (
                      <span className="text-game-success font-bold">+{result.pointsThisGame}</span>
                    ) : (
                      <span className="text-gray-500">+0</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Leaderboard Preview */}
        {leaderboard.length > 0 && (
          <button
            onClick={() => setShowLeaderboard(true)}
            className="card mb-4 w-full text-left hover:border-game-highlight transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">🏆 Leaderboard</p>
                <p className="text-white font-medium">
                  {leaderboard[0]?.name} leads with {leaderboard[0]?.score} pts
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handlePlayAgain}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Starting...' : 'Play Again'}
          </button>
          <button
            onClick={handleLeave}
            className="btn-secondary"
          >
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
}
