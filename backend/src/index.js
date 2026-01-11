const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameManager, STATUS } = require('./GameManager');
const { getCategories, getCategoryCounts, getTotalPairs } = require('./wordDatabase');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const gameManager = new GameManager();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: gameManager.rooms.size });
});

// Get available word pair categories
app.get('/categories', (req, res) => {
  const categories = getCategories();
  const counts = getCategoryCounts();
  const total = getTotalPairs();
  res.json({
    categories: categories.map(cat => ({
      name: cat,
      count: counts[cat] || 0
    })),
    totalPairs: total
  });
});

io.on('connection', (socket) => {
  console.log(`Host connected: ${socket.id}`);

  socket.on('CREATE_ROOM', ({ playerName }, callback) => {
    try {
      const room = gameManager.createRoom(socket.id, playerName);
      socket.join(room.code);
      console.log(`Room ${room.code} created by ${playerName}`);
      callback({
        success: true,
        roomCode: room.code,
        room: gameManager.getPublicRoomState(room)
      });
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ success: false, error: 'Failed to create room' });
    }
  });

  socket.on('ADD_PLAYER', ({ roomCode, playerName }, callback) => {
    try {
      const result = gameManager.addLocalPlayer(roomCode, socket.id, playerName);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`${playerName} added to room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room)
      });
    } catch (error) {
      console.error('Error adding player:', error);
      callback({ success: false, error: 'Failed to add player' });
    }
  });

  socket.on('REMOVE_PLAYER', ({ roomCode, playerId }, callback) => {
    try {
      const result = gameManager.removeLocalPlayer(roomCode, socket.id, playerId);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Player removed from room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room)
      });
    } catch (error) {
      console.error('Error removing player:', error);
      callback({ success: false, error: 'Failed to remove player' });
    }
  });

  socket.on('UPDATE_SETTINGS', ({ roomCode, settings }, callback) => {
    try {
      const result = gameManager.updateSettings(roomCode, socket.id, settings);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Settings updated in room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room)
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      callback({ success: false, error: 'Failed to update settings' });
    }
  });

  socket.on('START_GAME', ({ roomCode }, callback) => {
    try {
      const result = gameManager.startGame(roomCode, socket.id);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Game started in room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room, true)
      });
    } catch (error) {
      console.error('Error starting game:', error);
      callback({ success: false, error: 'Failed to start game' });
    }
  });

  socket.on('REVEAL_ROLE', ({ roomCode, playerId }, callback) => {
    try {
      const result = gameManager.revealRole(roomCode, playerId);
      if (!result.success) {
        callback(result);
        return;
      }
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room, true),
        allRevealed: result.allRevealed
      });
    } catch (error) {
      console.error('Error revealing role:', error);
      callback({ success: false, error: 'Failed to reveal role' });
    }
  });

  socket.on('ELIMINATE_PLAYER', ({ roomCode, playerId }, callback) => {
    try {
      const result = gameManager.eliminatePlayer(roomCode, playerId);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Player eliminated in room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room),
        eliminated: result.eliminated,
        mrWhiteChance: result.mrWhiteChance,
        gameOver: result.gameOver,
        winners: result.winners,
        winReason: result.winReason,
        continueGame: result.continueGame,
        scoreResults: result.scoreResults,
        leaderboard: result.leaderboard
      });
    } catch (error) {
      console.error('Error eliminating player:', error);
      callback({ success: false, error: 'Failed to eliminate player' });
    }
  });

  socket.on('SKIP_ELIMINATION', ({ roomCode }, callback) => {
    try {
      const result = gameManager.skipElimination(roomCode);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Elimination skipped in room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room),
        skipped: true
      });
    } catch (error) {
      console.error('Error skipping elimination:', error);
      callback({ success: false, error: 'Failed to skip' });
    }
  });

  socket.on('MR_WHITE_GUESS', ({ roomCode, guess }, callback) => {
    try {
      const result = gameManager.mrWhiteGuess(roomCode, guess);
      if (!result.success) {
        callback(result);
        return;
      }
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room),
        correct: result.correct,
        guess: result.guess,
        continueGame: result.continueGame,
        winners: result.winners,
        winReason: result.winReason,
        wordPair: result.room?.wordPair,
        scoreResults: result.scoreResults,
        leaderboard: result.leaderboard
      });
    } catch (error) {
      console.error('Error processing guess:', error);
      callback({ success: false, error: 'Failed to process guess' });
    }
  });

  socket.on('RESET_SCORES', ({ roomCode }, callback) => {
    try {
      const room = gameManager.resetScores(roomCode);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }
      callback({
        success: true,
        room: gameManager.getPublicRoomState(room)
      });
    } catch (error) {
      console.error('Error resetting scores:', error);
      callback({ success: false, error: 'Failed to reset scores' });
    }
  });

  socket.on('PLAY_AGAIN', ({ roomCode }, callback) => {
    try {
      const room = gameManager.resetRoom(roomCode);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }
      callback({
        success: true,
        room: gameManager.getPublicRoomState(room)
      });
    } catch (error) {
      console.error('Error resetting room:', error);
      callback({ success: false, error: 'Failed to reset room' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Host disconnected: ${socket.id}`);
    const result = gameManager.leaveRoom(socket.id);
    if (result) {
      console.log(`Room ${result.roomCode} deleted`);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Undercover backend running on port ${PORT}`);
});
