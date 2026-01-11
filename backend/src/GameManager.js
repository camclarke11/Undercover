const { getRandomWordPair, getCategories, getCategoryCounts } = require('./wordDatabase');

// Game status constants
const STATUS = {
  WAITING: 'WAITING',
  ROLE_REVEAL: 'ROLE_REVEAL',
  PLAYING: 'PLAYING',
  MR_WHITE_GUESS: 'MR_WHITE_GUESS',
  FINISHED: 'FINISHED'
};

// Role constants
const ROLE = {
  CIVILIAN: 'Civilian',
  UNDERCOVER: 'Undercover',
  MR_WHITE: 'Mr. White'
};

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.playerIdCounter = 0;
  }

  generatePlayerId() {
    return `player_${++this.playerIdCounter}_${Date.now()}`;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostSocketId, hostName) {
    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      hostSocketId: hostSocketId,
      status: STATUS.WAITING,
      wordPair: null,
      players: [{
        id: this.generatePlayerId(),
        socketId: hostSocketId,
        name: hostName,
        role: null,
        word: null,
        isAlive: true,
        isHost: true,
        hasRevealed: false,
        score: 0,
        gamesPlayed: 0,
        gamesWon: 0
      }],
      settings: {
        undercoverCount: 1,
        includeMrWhite: false,
        selectedCategories: getCategories() // All categories selected by default
      },
      speakingOrder: [],
      round: 0,
      mrWhiteGuesserId: null,
      gameHistory: [] // Track game results
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  updateSettings(roomCode, hostSocketId, settings) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    const host = room.players.find(p => p.isHost);
    if (!host || host.socketId !== hostSocketId) {
      return { success: false, error: 'Only host can change settings' };
    }
    
    if (room.status !== STATUS.WAITING) {
      return { success: false, error: 'Cannot change settings during game' };
    }

    if (settings.undercoverCount !== undefined) {
      const count = parseInt(settings.undercoverCount);
      if (count >= 1 && count <= 4) {
        room.settings.undercoverCount = count;
      }
    }

    if (settings.includeMrWhite !== undefined) {
      room.settings.includeMrWhite = Boolean(settings.includeMrWhite);
    }

    if (settings.selectedCategories !== undefined) {
      // Validate that selectedCategories is an array of valid categories
      const validCategories = getCategories();
      const filtered = settings.selectedCategories.filter(cat => validCategories.includes(cat));
      room.settings.selectedCategories = filtered.length > 0 ? filtered : validCategories;
    }

    return { success: true, room };
  }

  addLocalPlayer(roomCode, hostSocketId, playerName) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    const host = room.players.find(p => p.isHost);
    if (!host || host.socketId !== hostSocketId) {
      return { success: false, error: 'Only host can add players' };
    }
    
    if (room.status !== STATUS.WAITING) {
      return { success: false, error: 'Game already in progress' };
    }
    
    if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return { success: false, error: 'Name already taken' };
    }
    
    if (room.players.length >= 12) {
      return { success: false, error: 'Room is full (max 12 players)' };
    }

    room.players.push({
      id: this.generatePlayerId(),
      socketId: null,
      name: playerName,
      role: null,
      word: null,
      isAlive: true,
      isHost: false,
      hasRevealed: false,
      score: 0,
      gamesPlayed: 0,
      gamesWon: 0
    });

    return { success: true, room };
  }

  removeLocalPlayer(roomCode, hostSocketId, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    
    const host = room.players.find(p => p.isHost);
    if (!host || host.socketId !== hostSocketId) {
      return { success: false, error: 'Only host can remove players' };
    }
    
    if (room.status !== STATUS.WAITING) {
      return { success: false, error: 'Cannot remove players during game' };
    }

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, error: 'Player not found' };
    }

    const player = room.players[playerIndex];
    if (player.isHost) {
      return { success: false, error: 'Cannot remove the host' };
    }

    room.players.splice(playerIndex, 1);
    return { success: true, room };
  }

  leaveRoom(socketId) {
    for (const [code, room] of this.rooms) {
      const host = room.players.find(p => p.isHost);
      if (host && host.socketId === socketId) {
        this.rooms.delete(code);
        return { roomCode: code, room: null, wasHost: true };
      }
    }
    return null;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  startGame(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const host = room.players.find(p => p.isHost);
    if (!host || host.socketId !== socketId) {
      return { success: false, error: 'Only host can start the game' };
    }

    if (room.players.length < 3) {
      return { success: false, error: 'Need at least 3 players to start' };
    }

    const playerCount = room.players.length;
    const { undercoverCount, includeMrWhite } = room.settings;
    const mrWhiteCount = includeMrWhite ? 1 : 0;
    const totalBadGuys = undercoverCount + mrWhiteCount;

    if (totalBadGuys >= playerCount - 1) {
      return { 
        success: false, 
        error: `Too many special roles for ${playerCount} players.` 
      };
    }

    this.assignRoles(room);
    // Get word pair from selected categories
    room.wordPair = this.getWordPairFromCategories(room.settings.selectedCategories);

    room.players.forEach(player => {
      if (player.role === ROLE.CIVILIAN) {
        player.word = room.wordPair.civ;
      } else if (player.role === ROLE.UNDERCOVER) {
        player.word = room.wordPair.und;
      } else if (player.role === ROLE.MR_WHITE) {
        player.word = null;
      }
      player.hasRevealed = false;
    });

    // Randomize initial order
    this.shuffleArray(room.players);
    room.status = STATUS.ROLE_REVEAL;
    room.round = 1;
    
    // Set speaking order for round 1
    this.updateSpeakingOrder(room);

    return { success: true, room };
  }

  updateSpeakingOrder(room) {
    // Speaking order is all alive players in their current array order
    room.speakingOrder = room.players
      .filter(p => p.isAlive)
      .map(p => ({ id: p.id, name: p.name }));
  }

  revealRole(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.ROLE_REVEAL) {
      return { success: false, error: 'Cannot reveal role now' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    player.hasRevealed = true;

    const allRevealed = room.players.every(p => p.hasRevealed);
    if (allRevealed) {
      room.status = STATUS.PLAYING;
    }

    return { success: true, room, allRevealed };
  }

  // Host selects who was voted out
  eliminatePlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.PLAYING) {
      return { success: false, error: 'Cannot eliminate now' };
    }

    const player = room.players.find(p => p.id === playerId && p.isAlive);
    if (!player) {
      return { success: false, error: 'Player not found or already eliminated' };
    }

    player.isAlive = false;

    // Check if Mr. White was eliminated - they get a chance to guess
    if (player.role === ROLE.MR_WHITE) {
      room.status = STATUS.MR_WHITE_GUESS;
      room.mrWhiteGuesserId = player.id;
      return {
        success: true,
        room,
        eliminated: { name: player.name, id: player.id, role: player.role },
        mrWhiteChance: true
      };
    }

    // Check win conditions
    const gameResult = this.checkWinCondition(room);
    if (gameResult) {
      room.status = STATUS.FINISHED;
      const scoreResults = this.awardPoints(room, gameResult.winners);
      return {
        success: true,
        room,
        eliminated: { name: player.name, id: player.id, role: player.role },
        gameOver: true,
        winners: gameResult.winners,
        winReason: gameResult.reason,
        scoreResults,
        leaderboard: this.getLeaderboard(room)
      };
    }

    // Continue to next round
    room.round++;
    this.updateSpeakingOrder(room);

    return {
      success: true,
      room,
      eliminated: { name: player.name, id: player.id, role: player.role },
      continueGame: true
    };
  }

  // Skip elimination (tie vote)
  skipElimination(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.PLAYING) {
      return { success: false, error: 'Cannot skip now' };
    }

    room.round++;
    this.updateSpeakingOrder(room);

    return { success: true, room, skipped: true };
  }

  mrWhiteGuess(roomCode, guess) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.MR_WHITE_GUESS) {
      return { success: false, error: 'Cannot guess now' };
    }

    const mrWhite = room.players.find(p => p.id === room.mrWhiteGuesserId);
    const civilianWord = room.wordPair.civ.toLowerCase();
    const guessLower = guess.toLowerCase().trim();

    if (guessLower === civilianWord) {
      room.status = STATUS.FINISHED;
      const scoreResults = this.awardPoints(room, ['Mr. White'], true);
      return {
        success: true,
        room,
        correct: true,
        winners: ['Mr. White'],
        winReason: `Mr. White (${mrWhite.name}) correctly guessed the word: "${room.wordPair.civ}"!`,
        scoreResults,
        leaderboard: this.getLeaderboard(room)
      };
    } else {
      // Mr. White failed, check remaining win condition
      const gameResult = this.checkWinCondition(room);
      if (gameResult) {
        room.status = STATUS.FINISHED;
        const scoreResults = this.awardPoints(room, gameResult.winners);
        return {
          success: true,
          room,
          correct: false,
          guess,
          winners: gameResult.winners,
          winReason: gameResult.reason,
          scoreResults,
          leaderboard: this.getLeaderboard(room)
        };
      }
      // Continue game
      room.status = STATUS.PLAYING;
      room.round++;
      this.updateSpeakingOrder(room);
      return {
        success: true,
        room,
        correct: false,
        guess,
        continueGame: true
      };
    }
  }

  assignRoles(room) {
    const playerCount = room.players.length;
    const { undercoverCount, includeMrWhite } = room.settings;
    const mrWhiteCount = includeMrWhite ? 1 : 0;

    const roles = [];
    for (let i = 0; i < undercoverCount; i++) {
      roles.push(ROLE.UNDERCOVER);
    }
    for (let i = 0; i < mrWhiteCount; i++) {
      roles.push(ROLE.MR_WHITE);
    }
    while (roles.length < playerCount) {
      roles.push(ROLE.CIVILIAN);
    }

    this.shuffleArray(roles);
    room.players.forEach((player, index) => {
      player.role = roles[index];
    });
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  getWordPairFromCategories(selectedCategories) {
    // Pick a random category from selected ones, then get a word pair from it
    if (!selectedCategories || selectedCategories.length === 0) {
      return getRandomWordPair();
    }
    const randomCategory = selectedCategories[Math.floor(Math.random() * selectedCategories.length)];
    return getRandomWordPair(randomCategory);
  }

  checkWinCondition(room) {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const aliveCivilians = alivePlayers.filter(p => p.role === ROLE.CIVILIAN);
    const aliveUndercover = alivePlayers.filter(p => p.role === ROLE.UNDERCOVER);
    const aliveMrWhite = alivePlayers.filter(p => p.role === ROLE.MR_WHITE);

    if (aliveUndercover.length + aliveMrWhite.length >= aliveCivilians.length) {
      const winners = [];
      if (aliveUndercover.length > 0) winners.push('Undercover');
      if (aliveMrWhite.length > 0) winners.push('Mr. White');
      return {
        winners,
        reason: 'The bad guys outnumber the civilians!'
      };
    }

    if (aliveUndercover.length === 0 && aliveMrWhite.length === 0) {
      return {
        winners: ['Civilians'],
        reason: 'All undercover agents and Mr. White have been eliminated!'
      };
    }

    return null;
  }

  // Calculate and award points at end of game
  awardPoints(room, winners, mrWhiteCorrectGuess = false) {
    const pointsAwarded = [];

    room.players.forEach(player => {
      player.gamesPlayed++;
      let points = 0;
      let breakdown = [];

      const isWinner = (
        (winners.includes('Civilians') && player.role === ROLE.CIVILIAN) ||
        (winners.includes('Undercover') && player.role === ROLE.UNDERCOVER) ||
        (winners.includes('Mr. White') && player.role === ROLE.MR_WHITE)
      );

      if (isWinner) {
        player.gamesWon++;
        points += 10;
        breakdown.push('+10 Win');

        // Survival bonus for winners who are still alive
        if (player.isAlive) {
          points += 5;
          breakdown.push('+5 Survived');
        }

        // Mr. White correct guess bonus
        if (mrWhiteCorrectGuess && player.role === ROLE.MR_WHITE) {
          points += 5;
          breakdown.push('+5 Correct Guess');
        }
      } else {
        // Consolation points for surviving undercover/mr white who lost
        if (player.isAlive && (player.role === ROLE.UNDERCOVER || player.role === ROLE.MR_WHITE)) {
          points += 2;
          breakdown.push('+2 Survived');
        }
      }

      player.score += points;
      pointsAwarded.push({
        id: player.id,
        name: player.name,
        role: player.role,
        pointsThisGame: points,
        breakdown,
        totalScore: player.score,
        gamesPlayed: player.gamesPlayed,
        gamesWon: player.gamesWon
      });
    });

    // Sort by points this game (descending)
    pointsAwarded.sort((a, b) => b.pointsThisGame - a.pointsThisGame);

    // Store in game history
    room.gameHistory.push({
      round: room.gameHistory.length + 1,
      winners,
      wordPair: room.wordPair,
      scores: pointsAwarded
    });

    return pointsAwarded;
  }

  getLeaderboard(room) {
    return room.players
      .map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        gamesPlayed: p.gamesPlayed,
        gamesWon: p.gamesWon
      }))
      .sort((a, b) => b.score - a.score);
  }

  resetRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.status = STATUS.WAITING;
    room.wordPair = null;
    room.speakingOrder = [];
    room.round = 0;
    room.mrWhiteGuesserId = null;
    // Reset game state but preserve scores
    room.players.forEach(player => {
      player.role = null;
      player.word = null;
      player.isAlive = true;
      player.hasRevealed = false;
      // Keep: score, gamesPlayed, gamesWon
    });

    return room;
  }

  // Reset all scores (new session)
  resetScores(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.gameHistory = [];
    room.players.forEach(player => {
      player.score = 0;
      player.gamesPlayed = 0;
      player.gamesWon = 0;
    });

    return room;
  }

  getPublicRoomState(room, includeSecrets = false) {
    const isGameActive = room.status !== STATUS.WAITING && room.status !== STATUS.FINISHED;
    const isRoleReveal = room.status === STATUS.ROLE_REVEAL;

    return {
      code: room.code,
      status: room.status,
      round: room.round,
      settings: room.settings,
      speakingOrder: room.speakingOrder,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isHost: p.isHost,
        hasRevealed: p.hasRevealed,
        score: p.score,
        gamesPlayed: p.gamesPlayed,
        gamesWon: p.gamesWon,
        role: (isRoleReveal || !isGameActive || includeSecrets) ? p.role : null,
        word: (isRoleReveal || !isGameActive || includeSecrets) ? p.word : null
      })),
      mrWhiteGuesserId: room.mrWhiteGuesserId,
      wordPair: room.status === STATUS.FINISHED ? room.wordPair : null,
      leaderboard: this.getLeaderboard(room),
      gamesPlayedTotal: room.gameHistory.length
    };
  }
}

module.exports = { GameManager, STATUS, ROLE };
