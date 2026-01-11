import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [hostName, setHostName] = useState('');
  const [error, setError] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [eliminationResult, setEliminationResult] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch available categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/categories`);
        const data = await response.json();
        setCategories(data.categories || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = useCallback((name) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Not connected'));
        return;
      }
      socket.emit('CREATE_ROOM', { playerName: name }, (response) => {
        if (response.success) {
          setHostName(name);
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket]);

  const addPlayer = useCallback((playerName) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('ADD_PLAYER', { roomCode: room.code, playerName }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const removePlayer = useCallback((playerId) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('REMOVE_PLAYER', { roomCode: room.code, playerId }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const updateSettings = useCallback((settings) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('UPDATE_SETTINGS', { roomCode: room.code, settings }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const startGame = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('START_GAME', { roomCode: room.code }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const revealRole = useCallback((playerId) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('REVEAL_ROLE', { roomCode: room.code, playerId }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const eliminatePlayer = useCallback((playerId) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('ELIMINATE_PLAYER', { roomCode: room.code, playerId }, (response) => {
        if (response.success) {
          setRoom(response.room);
          
          if (response.gameOver) {
            setGameResult({
              eliminated: response.eliminated,
              winners: response.winners,
              winReason: response.winReason,
              scoreResults: response.scoreResults,
              leaderboard: response.leaderboard
            });
          } else {
            setEliminationResult({
              eliminated: response.eliminated,
              mrWhiteChance: response.mrWhiteChance,
              continueGame: response.continueGame
            });
          }
          
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const skipElimination = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('SKIP_ELIMINATION', { roomCode: room.code }, (response) => {
        if (response.success) {
          setRoom(response.room);
          setEliminationResult({ skipped: true });
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const mrWhiteGuess = useCallback((guess) => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('MR_WHITE_GUESS', { roomCode: room.code, guess }, (response) => {
        if (response.success) {
          setRoom(response.room);
          
          if (response.continueGame) {
            setEliminationResult({ mrWhiteWrong: true, guess: response.guess });
          } else {
            setGameResult({
              mrWhiteGuess: guess,
              mrWhiteCorrect: response.correct,
              winners: response.winners,
              winReason: response.winReason,
              wordPair: response.wordPair,
              scoreResults: response.scoreResults,
              leaderboard: response.leaderboard
            });
          }
          
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const playAgain = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('PLAY_AGAIN', { roomCode: room.code }, (response) => {
        if (response.success) {
          setRoom(response.room);
          setGameResult(null);
          setEliminationResult(null);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const resetScores = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socket || !room) {
        reject(new Error('Not in a room'));
        return;
      }
      socket.emit('RESET_SCORES', { roomCode: room.code }, (response) => {
        if (response.success) {
          setRoom(response.room);
          resolve(response);
        } else {
          setError(response.error);
          reject(new Error(response.error));
        }
      });
    });
  }, [socket, room]);

  const leaveRoom = useCallback(() => {
    setRoom(null);
    setHostName('');
    setGameResult(null);
    setEliminationResult(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearEliminationResult = useCallback(() => {
    setEliminationResult(null);
  }, []);

  const value = {
    socket,
    connected,
    room,
    hostName,
    error,
    gameResult,
    eliminationResult,
    categories,
    categoriesLoading,
    createRoom,
    addPlayer,
    removePlayer,
    updateSettings,
    startGame,
    revealRole,
    eliminatePlayer,
    skipElimination,
    mrWhiteGuess,
    playAgain,
    resetScores,
    leaveRoom,
    clearError,
    clearEliminationResult
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
