import React, { useState, useMemo } from 'react';
import { useSocket } from '../contexts/SocketContext';

// Generate floating particles
function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      type: Math.random() > 0.5 ? 'circle' : 'diamond',
      color: ['#e94560', '#00d9ff', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)]
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.type === 'circle' ? '50%' : '2px',
            transform: p.type === 'diamond' ? 'rotate(45deg)' : 'none',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Radar effect component
function RadarEffect() {
  return (
    <div className="radar-container">
      <div className="radar-sweep" />
      <div className="radar-ring" style={{ inset: '20%' }} />
      <div className="radar-ring" style={{ inset: '35%' }} />
      <div className="radar-ring" style={{ inset: '50%' }} />
    </div>
  );
}

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
        <FloatingParticles />
        <div className="card text-center max-w-sm w-full relative z-10">
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-game-accent" />
            <p className="text-gray-400">Connecting to server...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <FloatingParticles />
      
      {/* Radar effect behind logo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
        <RadarEffect />
      </div>

      {/* Logo and title */}
      <div className="text-center mb-8 relative z-10">
        {/* Pulse rings behind logo */}
        <div className="relative w-24 h-24 mx-auto mb-4">
          <div className="pulse-ring absolute inset-0" />
          <div className="pulse-ring absolute inset-0" style={{ animationDelay: '0.5s' }} />
          <div className="pulse-ring absolute inset-0" style={{ animationDelay: '1s' }} />
          <img 
            src="/undercoverlogo.png" 
            alt="Undercover Logo" 
            className="w-24 h-24 rounded-2xl shadow-lg relative z-10 logo-glow float-animation" 
          />
        </div>
        
        <h1 className="text-5xl font-bold mb-2 shimmer-text">
          Undercover
        </h1>
        <p className="text-gray-400">The party game of hidden identities!</p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-sm relative z-10">
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
            {loading ? 'Creating...' : '🕵️ Start New Game'}
          </button>
        </form>
      </div>

      {/* Footer hint */}
      <div className="mt-12 text-center text-sm text-gray-500 max-w-xs relative z-10">
        <p>You'll be the game host. Add players manually and pass the phone around to reveal roles!</p>
      </div>
    </div>
  );
}
