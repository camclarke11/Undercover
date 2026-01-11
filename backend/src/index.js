const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameManager, STATUS } = require('./GameManager');
const wordStorage = require('./wordStorage');
const path = require('path');

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

// Serve static files from the frontend build directory
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: gameManager.rooms.size });
});

// ============================================
// WORD PAIR MANAGEMENT API
// ============================================

// Get available word pair categories
app.get('/api/categories', (req, res) => {
  const categories = wordStorage.getAllCategories();
  const total = wordStorage.getTotalPairs();
  res.json({
    categories,
    totalPairs: total
  });
});

// Get all word pairs (optionally filtered by category)
app.get('/api/words', (req, res) => {
  const { category } = req.query;
  let pairs;
  if (category) {
    pairs = wordStorage.getWordPairsByCategory(category);
  } else {
    pairs = wordStorage.getAllWordPairs();
  }
  res.json({ pairs, total: pairs.length });
});

// Add a new word pair
app.post('/api/words', (req, res) => {
  const { civ, und, cat } = req.body;
  if (!civ || !und || !cat) {
    return res.status(400).json({ error: 'Missing required fields: civ, und, cat' });
  }
  const newPair = wordStorage.addWordPair(civ, und, cat);
  res.json({ success: true, pair: newPair });
});

// Update a word pair
app.put('/api/words/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { civ, und, cat } = req.body;
  const updated = wordStorage.updateWordPair(id, { civ, und, cat });
  if (!updated) {
    return res.status(404).json({ error: 'Word pair not found' });
  }
  res.json({ success: true, pair: updated });
});

// Delete a word pair
app.delete('/api/words/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const deleted = wordStorage.deleteWordPair(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Word pair not found' });
  }
  res.json({ success: true });
});

// Bulk add word pairs
app.post('/api/words/bulk', (req, res) => {
  const { pairs } = req.body;
  if (!Array.isArray(pairs)) {
    return res.status(400).json({ error: 'pairs must be an array' });
  }
  const added = wordStorage.addBulkWordPairs(pairs);
  res.json({ success: true, added: added.length, pairs: added });
});

// Rename a category
app.put('/api/categories/:name', (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { newName } = req.body;
  if (!newName) {
    return res.status(400).json({ error: 'newName is required' });
  }
  const count = wordStorage.renameCategory(oldName, newName);
  res.json({ success: true, renamed: count });
});

// Delete a category and all its word pairs
app.delete('/api/categories/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const deleted = wordStorage.deleteCategory(name);
  res.json({ success: true, deleted });
});

// Reset to default word pairs
app.post('/api/words/reset', (req, res) => {
  const count = wordStorage.resetToDefaults();
  res.json({ success: true, count });
});

// Legacy endpoint for backwards compatibility
app.get('/categories', (req, res) => {
  const categories = wordStorage.getAllCategories();
  const total = wordStorage.getTotalPairs();
  res.json({
    categories,
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

  socket.on('UNDO_ACTION', ({ roomCode }, callback) => {
    try {
      const result = gameManager.undoLastAction(roomCode);
      if (!result.success) {
        callback(result);
        return;
      }
      console.log(`Undo action in room ${roomCode}`);
      callback({
        success: true,
        room: gameManager.getPublicRoomState(result.room)
      });
    } catch (error) {
      console.error('Error undoing action:', error);
      callback({ success: false, error: 'Failed to undo' });
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

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Undercover backend running on port ${PORT}`);
});
