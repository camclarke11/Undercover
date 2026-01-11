import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Landing() {
  const { connected, createRoom, error, clearError } = useSocket();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    clearError();
    try {
      await createRoom(name.trim());
    } catch (err) {
      console.error('Failed to create room:', err);
    }
    setLoading(false);
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="card text-center max-w-sm w-full">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-accent" />
            <p className="text-gray-400">Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <img src="/undercoverlogo.png" alt="Undercover Logo" className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg" />
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-game-success to-game-highlight bg-clip-text text-transparent">
            Undercover
          </h1>
        <p className="text-gray-400">The party game of hidden identities!</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Your Name (Game Host)</label>
          <input
            type="text"
              placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
            maxLength={20}
            autoComplete="off"
          />
          </div>

          {error && (
            <div className="p-3 bg-game-highlight bg-opacity-20 border border-game-highlight rounded-xl text-center text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary"
          >
            {loading ? 'Creating...' : 'Start New Game'}
          </button>
        </form>
      </div>

      <div className="mt-12 text-center text-sm text-gray-500 max-w-xs">
        <p>You'll be the game host. Add players manually and pass the phone around to reveal roles!</p>
      </div>
    </div>
  );
}
