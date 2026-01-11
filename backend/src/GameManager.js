const wordStorage = require('./wordStorage');

// Game status constants
const STATUS = {
  WAITING: 'WAITING',
  ROLE_REVEAL: 'ROLE_REVEAL',
  PLAYING: 'PLAYING',
  MR_WHITE_GUESS: 'MR_WHITE_GUESS',
  REVENGER_REVENGE: 'REVENGER_REVENGE', // Revenger picks someone to take down with them
  FINISHED: 'FINISHED'
};

// Role constants
const ROLE = {
  CIVILIAN: 'Civilian',
  UNDERCOVER: 'Undercover',
  MR_WHITE: 'Mr. White'
};

// Special role constants
const SPECIAL_ROLE = {
  JOY_FOOL: 'Joy Fool',
  LOVER: 'Lover',
  REVENGER: 'Revenger',
  DUELIST: 'Duelist',
  MR_MEME: 'Mr. Meme'
};

// Special roles that require minimum player counts
const SPECIAL_ROLE_MIN_PLAYERS = {
  [SPECIAL_ROLE.JOY_FOOL]: 3,
  [SPECIAL_ROLE.LOVER]: 5,
  [SPECIAL_ROLE.REVENGER]: 5,
  [SPECIAL_ROLE.DUELIST]: 5,
  [SPECIAL_ROLE.MR_MEME]: 3
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
        gamesWon: 0,
        specialRole: null, // Joy Fool, Lover, Revenger, Duelist, or null
        specialRolePartner: null // For Lovers/Duelists - the partner's name
      }],
      settings: {
        undercoverCount: 1,
        includeMrWhite: false,
        hideRoleLabels: false,
        preventMrWhiteFirst: false,
        selectedCategories: wordStorage.getAllCategories().map(c => c.name),
        // Special roles settings
        enabledSpecialRoles: [], // Array of enabled special role types
        specialRoleChances: {
          // Percentage chance (0-100) that each role is assigned when enabled
          [SPECIAL_ROLE.JOY_FOOL]: 100,
          [SPECIAL_ROLE.LOVER]: 100,
          [SPECIAL_ROLE.REVENGER]: 100,
          [SPECIAL_ROLE.DUELIST]: 100,
          [SPECIAL_ROLE.MR_MEME]: 100
        }
      },
      speakingOrder: [],
      round: 0,
      mrWhiteGuesserId: null,
      gameHistory: [], // Track game results
      undoStack: [], // Stack of previous states for undo
      // Special roles game state
      specialRoles: {
        joyFool: { playerId: null },
        lovers: { playerIds: [] },
        duelists: { playerIds: [], firstEliminatedId: null },
        revenger: { playerId: null },
        mrMeme: { currentMimeId: null }
      },
      firstEliminatedId: null, // Track first elimination for Joy Fool
      revengerTargetId: null // Track who Revenger wants to take down
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  // Deep clone room state for undo stack
  // We only need to save the mutable game state, not static settings/players (unless players change mid-game)
  snapshotRoom(room) {
    return {
      status: room.status,
      players: JSON.parse(JSON.stringify(room.players)),
      speakingOrder: [...room.speakingOrder],
      round: room.round,
      mrWhiteGuesserId: room.mrWhiteGuesserId,
      wordPair: room.wordPair,
      // Special roles state
      specialRoles: JSON.parse(JSON.stringify(room.specialRoles)),
      firstEliminatedId: room.firstEliminatedId,
      revengerTargetId: room.revengerTargetId
    };
  }

  // Restore room state from snapshot
  restoreRoom(room, snapshot) {
    room.status = snapshot.status;
    room.players = snapshot.players;
    room.speakingOrder = snapshot.speakingOrder;
    room.round = snapshot.round;
    room.mrWhiteGuesserId = snapshot.mrWhiteGuesserId;
    room.wordPair = snapshot.wordPair;
    // Special roles state
    room.specialRoles = snapshot.specialRoles;
    room.firstEliminatedId = snapshot.firstEliminatedId;
    room.revengerTargetId = snapshot.revengerTargetId;
  }

  undoLastAction(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || !room.undoStack || room.undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' };
    }

    const snapshot = room.undoStack.pop();
    this.restoreRoom(room, snapshot);
    
    return { success: true, room };
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

    if (settings.hideRoleLabels !== undefined) {
      room.settings.hideRoleLabels = Boolean(settings.hideRoleLabels);
    }

    if (settings.preventMrWhiteFirst !== undefined) {
      room.settings.preventMrWhiteFirst = Boolean(settings.preventMrWhiteFirst);
    }

    if (settings.selectedCategories !== undefined) {
      // Validate that selectedCategories is an array of valid categories
      // Allow empty array - game start will validate that at least one is selected
      const validCategories = wordStorage.getAllCategories().map(c => c.name);
      const filtered = settings.selectedCategories.filter(cat => validCategories.includes(cat));
      room.settings.selectedCategories = filtered;
    }

    if (settings.enabledSpecialRoles !== undefined) {
      // Validate that enabledSpecialRoles is an array of valid special roles
      const validSpecialRoles = Object.values(SPECIAL_ROLE);
      const filtered = settings.enabledSpecialRoles.filter(role => validSpecialRoles.includes(role));
      room.settings.enabledSpecialRoles = filtered;
    }

    if (settings.specialRoleChances !== undefined) {
      // Validate and update individual role chances
      const validSpecialRoles = Object.values(SPECIAL_ROLE);
      for (const [role, chance] of Object.entries(settings.specialRoleChances)) {
        if (validSpecialRoles.includes(role)) {
          // Clamp chance between 0 and 100
          const validChance = Math.max(0, Math.min(100, parseInt(chance) || 0));
          room.settings.specialRoleChances[role] = validChance;
        }
      }
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
      gamesWon: 0,
      specialRole: null,
      specialRolePartner: null
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

    // Check that at least one category is selected
    if (!room.settings.selectedCategories || room.settings.selectedCategories.length === 0) {
      return {
        success: false,
        error: 'Select at least one word category'
      };
    }

    this.assignRoles(room);
    this.assignSpecialRoles(room);
    
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

    // If setting enabled, ensure Mr. White isn't first
    if (room.settings.preventMrWhiteFirst && room.settings.includeMrWhite && room.players.length > 1) {
      // Keep shuffling until first player is NOT Mr. White
      // (Safety break after 10 tries just in case everyone is Mr. White somehow)
      let attempts = 0;
      while (room.players[0].role === ROLE.MR_WHITE && attempts < 10) {
        this.shuffleArray(room.players);
        attempts++;
      }
    }

    room.status = STATUS.ROLE_REVEAL;
    room.round = 1;
    
    // Set speaking order for round 1
    this.updateSpeakingOrder(room);
    
    // Initialize Mr. Meme for first round if enabled
    if (room.settings.enabledSpecialRoles.includes(SPECIAL_ROLE.MR_MEME)) {
      this.selectMrMemePlayer(room);
    }

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

    // Save state before modification
    room.undoStack.push(this.snapshotRoom(room));

    player.isAlive = false;
    
    // Track first elimination for Joy Fool
    if (room.firstEliminatedId === null) {
      room.firstEliminatedId = player.id;
    }
    
    // Track Duelists - record which one was eliminated first
    if (player.specialRole === SPECIAL_ROLE.DUELIST && 
        room.specialRoles.duelists.firstEliminatedId === null) {
      room.specialRoles.duelists.firstEliminatedId = player.id;
    }
    
    // Build eliminated list (may include multiple due to Lovers)
    const eliminatedPlayers = [{ 
      name: player.name, 
      id: player.id, 
      role: player.role,
      specialRole: player.specialRole 
    }];
    
    // Handle Lovers - if a Lover is eliminated, their partner dies too
    if (player.specialRole === SPECIAL_ROLE.LOVER) {
      const partnerPlayer = room.players.find(p => 
        p.id !== player.id && 
        p.specialRole === SPECIAL_ROLE.LOVER && 
        p.isAlive
      );
      if (partnerPlayer) {
        partnerPlayer.isAlive = false;
        eliminatedPlayers.push({
          name: partnerPlayer.name,
          id: partnerPlayer.id,
          role: partnerPlayer.role,
          specialRole: partnerPlayer.specialRole,
          loversLinked: true
        });
        
        // Track if partner was first eliminated (for Joy Fool)
        // Also track Duelists
        if (partnerPlayer.specialRole === SPECIAL_ROLE.DUELIST && 
            room.specialRoles.duelists.firstEliminatedId === null) {
          room.specialRoles.duelists.firstEliminatedId = partnerPlayer.id;
        }
      }
    }

    // Check if Mr. White was eliminated - they get a chance to guess
    if (player.role === ROLE.MR_WHITE) {
      room.status = STATUS.MR_WHITE_GUESS;
      room.mrWhiteGuesserId = player.id;
      return {
        success: true,
        room,
        eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
        mrWhiteChance: true
      };
    }
    
    // Check if Revenger was eliminated - they get to pick someone to take down
    if (player.specialRole === SPECIAL_ROLE.REVENGER) {
      const alivePlayers = room.players.filter(p => p.isAlive);
      if (alivePlayers.length > 0) {
        room.status = STATUS.REVENGER_REVENGE;
        room.revengerTargetId = null; // Will be set when they pick
        return {
          success: true,
          room,
          eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
          revengerChance: true,
          revengerId: player.id,
          revengerName: player.name
        };
      }
    }

    // Check win conditions
    const gameResult = this.checkWinCondition(room);
    if (gameResult) {
      room.status = STATUS.FINISHED;
      const scoreResults = this.awardPoints(room, gameResult.winners);
      return {
        success: true,
        room,
        eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
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
    
    // Select new Mr. Meme player for the new round
    if (room.settings.enabledSpecialRoles.includes(SPECIAL_ROLE.MR_MEME)) {
      this.selectMrMemePlayer(room);
    }

    return {
      success: true,
      room,
      eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
      continueGame: true
    };
  }
  
  // Revenger picks someone to eliminate with them
  revengerPickVictim(roomCode, victimId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.REVENGER_REVENGE) {
      return { success: false, error: 'Cannot pick victim now' };
    }
    
    const victim = room.players.find(p => p.id === victimId && p.isAlive);
    if (!victim) {
      return { success: false, error: 'Victim not found or already eliminated' };
    }
    
    // Save state before modification
    room.undoStack.push(this.snapshotRoom(room));
    
    victim.isAlive = false;
    room.revengerTargetId = victimId;
    
    // Track Duelists
    if (victim.specialRole === SPECIAL_ROLE.DUELIST && 
        room.specialRoles.duelists.firstEliminatedId === null) {
      room.specialRoles.duelists.firstEliminatedId = victim.id;
    }
    
    const eliminatedPlayers = [{
      name: victim.name,
      id: victim.id,
      role: victim.role,
      specialRole: victim.specialRole,
      revengerVictim: true
    }];
    
    // If victim is a Lover, their partner also dies
    if (victim.specialRole === SPECIAL_ROLE.LOVER) {
      const partnerPlayer = room.players.find(p => 
        p.id !== victim.id && 
        p.specialRole === SPECIAL_ROLE.LOVER && 
        p.isAlive
      );
      if (partnerPlayer) {
        partnerPlayer.isAlive = false;
        eliminatedPlayers.push({
          name: partnerPlayer.name,
          id: partnerPlayer.id,
          role: partnerPlayer.role,
          specialRole: partnerPlayer.specialRole,
          loversLinked: true
        });
      }
    }
    
    // If victim is Mr. White, they get a guess
    if (victim.role === ROLE.MR_WHITE) {
      room.status = STATUS.MR_WHITE_GUESS;
      room.mrWhiteGuesserId = victim.id;
      return {
        success: true,
        room,
        eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
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
        eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
        gameOver: true,
        winners: gameResult.winners,
        winReason: gameResult.reason,
        scoreResults,
        leaderboard: this.getLeaderboard(room)
      };
    }
    
    // Continue to next round
    room.status = STATUS.PLAYING;
    room.round++;
    this.updateSpeakingOrder(room);
    
    // Select new Mr. Meme player for the new round
    if (room.settings.enabledSpecialRoles.includes(SPECIAL_ROLE.MR_MEME)) {
      this.selectMrMemePlayer(room);
    }
    
    return {
      success: true,
      room,
      eliminated: eliminatedPlayers.length === 1 ? eliminatedPlayers[0] : eliminatedPlayers,
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
    
    // Select new Mr. Meme player for the new round
    if (room.settings.enabledSpecialRoles.includes(SPECIAL_ROLE.MR_MEME)) {
      this.selectMrMemePlayer(room);
    }

    return { success: true, room, skipped: true };
  }

  mrWhiteGuess(roomCode, guess) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== STATUS.MR_WHITE_GUESS) {
      return { success: false, error: 'Cannot guess now' };
    }

    // Save state before processing guess
    room.undoStack.push(this.snapshotRoom(room));

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

  // Check if a special role should be assigned based on its chance setting
  shouldAssignRole(room, roleType) {
    const chance = room.settings.specialRoleChances?.[roleType] ?? 100;
    if (chance >= 100) return true;
    if (chance <= 0) return false;
    return Math.random() * 100 < chance;
  }

  // Assign special roles to players
  assignSpecialRoles(room) {
    const playerCount = room.players.length;
    const enabledRoles = room.settings.enabledSpecialRoles || [];
    
    // Reset special roles
    room.players.forEach(player => {
      player.specialRole = null;
      player.specialRolePartner = null;
    });
    room.specialRoles = {
      joyFool: { playerId: null },
      lovers: { playerIds: [] },
      duelists: { playerIds: [], firstEliminatedId: null },
      revenger: { playerId: null },
      mrMeme: { currentMimeId: null }
    };
    room.firstEliminatedId = null;
    room.revengerTargetId = null;
    
    // Get available players (shuffle for random assignment)
    const availablePlayers = [...room.players];
    this.shuffleArray(availablePlayers);
    
    // Track which players have been assigned special roles
    const assignedPlayerIds = new Set();
    
    // Assign Joy Fool (single player, 3+ players)
    if (enabledRoles.includes(SPECIAL_ROLE.JOY_FOOL) && 
        playerCount >= SPECIAL_ROLE_MIN_PLAYERS[SPECIAL_ROLE.JOY_FOOL] &&
        this.shouldAssignRole(room, SPECIAL_ROLE.JOY_FOOL)) {
      const candidate = availablePlayers.find(p => !assignedPlayerIds.has(p.id));
      if (candidate) {
        candidate.specialRole = SPECIAL_ROLE.JOY_FOOL;
        room.specialRoles.joyFool.playerId = candidate.id;
        assignedPlayerIds.add(candidate.id);
      }
    }
    
    // Assign Revenger (single player, 5+ players)
    // RESTRICTION: Cannot be Mr. White (they already have guess ability when eliminated)
    if (enabledRoles.includes(SPECIAL_ROLE.REVENGER) && 
        playerCount >= SPECIAL_ROLE_MIN_PLAYERS[SPECIAL_ROLE.REVENGER] &&
        this.shouldAssignRole(room, SPECIAL_ROLE.REVENGER)) {
      const candidate = availablePlayers.find(p => 
        !assignedPlayerIds.has(p.id) && p.role !== ROLE.MR_WHITE
      );
      if (candidate) {
        candidate.specialRole = SPECIAL_ROLE.REVENGER;
        room.specialRoles.revenger.playerId = candidate.id;
        assignedPlayerIds.add(candidate.id);
      }
    }
    
    // Assign Lovers (pair, 5+ players)
    // RESTRICTION: At least one lover must be a Civilian (prevents both undercovers being linked)
    if (enabledRoles.includes(SPECIAL_ROLE.LOVER) && 
        playerCount >= SPECIAL_ROLE_MIN_PLAYERS[SPECIAL_ROLE.LOVER] &&
        this.shouldAssignRole(room, SPECIAL_ROLE.LOVER)) {
      const candidates = availablePlayers.filter(p => !assignedPlayerIds.has(p.id));
      const civilians = candidates.filter(p => p.role === ROLE.CIVILIAN);
      
      // Need at least one civilian and one other player
      if (civilians.length >= 1 && candidates.length >= 2) {
        // First lover is always a civilian
        const lover1 = civilians[0];
        // Second lover can be anyone else (civilian or non-civilian)
        const lover2 = candidates.find(p => p.id !== lover1.id);
        
        if (lover2) {
          lover1.specialRole = SPECIAL_ROLE.LOVER;
          lover2.specialRole = SPECIAL_ROLE.LOVER;
          lover1.specialRolePartner = lover2.name;
          lover2.specialRolePartner = lover1.name;
          room.specialRoles.lovers.playerIds = [lover1.id, lover2.id];
          assignedPlayerIds.add(lover1.id);
          assignedPlayerIds.add(lover2.id);
        }
      }
    }
    
    // Assign Duelists (pair, 5+ players)
    if (enabledRoles.includes(SPECIAL_ROLE.DUELIST) && 
        playerCount >= SPECIAL_ROLE_MIN_PLAYERS[SPECIAL_ROLE.DUELIST] &&
        this.shouldAssignRole(room, SPECIAL_ROLE.DUELIST)) {
      const candidates = availablePlayers.filter(p => !assignedPlayerIds.has(p.id));
      if (candidates.length >= 2) {
        const duelist1 = candidates[0];
        const duelist2 = candidates[1];
        duelist1.specialRole = SPECIAL_ROLE.DUELIST;
        duelist2.specialRole = SPECIAL_ROLE.DUELIST;
        duelist1.specialRolePartner = duelist2.name;
        duelist2.specialRolePartner = duelist1.name;
        room.specialRoles.duelists.playerIds = [duelist1.id, duelist2.id];
        assignedPlayerIds.add(duelist1.id);
        assignedPlayerIds.add(duelist2.id);
      }
    }
    
    // Note: Mr. Meme is not assigned to a specific player at game start
    // Instead, a random player is selected each round via selectMrMemePlayer
  }
  
  // Select a random alive player to be Mr. Meme for the current round
  // RESTRICTION: Cannot be Mr. White (gestures would help hide their wordlessness)
  selectMrMemePlayer(room) {
    if (!room.settings.enabledSpecialRoles.includes(SPECIAL_ROLE.MR_MEME)) {
      room.specialRoles.mrMeme.currentMimeId = null;
      return;
    }
    
    // Check if Mr. Meme should be active this round based on chance
    if (!this.shouldAssignRole(room, SPECIAL_ROLE.MR_MEME)) {
      room.specialRoles.mrMeme.currentMimeId = null;
      return;
    }
    
    // Exclude Mr. White from being Mr. Meme (gestures help them hide wordlessness)
    const eligiblePlayers = room.players.filter(p => p.isAlive && p.role !== ROLE.MR_WHITE);
    if (eligiblePlayers.length === 0) {
      room.specialRoles.mrMeme.currentMimeId = null;
      return;
    }
    
    // Pick a random eligible player
    const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
    room.specialRoles.mrMeme.currentMimeId = eligiblePlayers[randomIndex].id;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  getWordPairFromCategories(selectedCategories) {
    // Get a random word pair from the selected categories
    return wordStorage.getRandomWordPair(selectedCategories);
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
      
      // Special Role: Joy Fool - +4 points if voted out first
      if (player.specialRole === SPECIAL_ROLE.JOY_FOOL && 
          room.firstEliminatedId === player.id) {
        points += 4;
        breakdown.push('+4 Joy Fool (1st out)');
      }
      
      // Special Role: Duelists - first eliminated loses 2, survivor wins 2
      if (player.specialRole === SPECIAL_ROLE.DUELIST) {
        const firstEliminatedDuelistId = room.specialRoles.duelists.firstEliminatedId;
        if (firstEliminatedDuelistId === player.id) {
          // This player was eliminated first
          points -= 2;
          breakdown.push('-2 Duel Lost');
        } else if (firstEliminatedDuelistId !== null) {
          // The other duelist was eliminated first, this player wins the duel
          points += 2;
          breakdown.push('+2 Duel Won');
        }
        // If neither duelist was eliminated, no bonus/penalty
      }

      player.score += points;
      pointsAwarded.push({
        id: player.id,
        name: player.name,
        role: player.role,
        specialRole: player.specialRole,
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
    room.undoStack = [];
    
    // Reset special roles state
    room.specialRoles = {
      joyFool: { playerId: null },
      lovers: { playerIds: [] },
      duelists: { playerIds: [], firstEliminatedId: null },
      revenger: { playerId: null },
      mrMeme: { currentMimeId: null }
    };
    room.firstEliminatedId = null;
    room.revengerTargetId = null;
    
    // Reset game state but preserve scores
    room.players.forEach(player => {
      player.role = null;
      player.word = null;
      player.isAlive = true;
      player.hasRevealed = false;
      player.specialRole = null;
      player.specialRolePartner = null;
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
        word: (isRoleReveal || !isGameActive || includeSecrets) ? p.word : null,
        specialRole: (isRoleReveal || !isGameActive || includeSecrets) ? p.specialRole : null,
        specialRolePartner: (isRoleReveal || !isGameActive || includeSecrets) ? p.specialRolePartner : null
      })),
      mrWhiteGuesserId: room.mrWhiteGuesserId,
      wordPair: room.status === STATUS.FINISHED ? room.wordPair : null,
      leaderboard: this.getLeaderboard(room),
      gamesPlayedTotal: room.gameHistory.length,
      // Special roles state (safe to expose)
      specialRoles: {
        mrMeme: room.specialRoles?.mrMeme || { currentMimeId: null }
      },
      revengerTargetId: room.revengerTargetId
    };
  }
}

module.exports = { GameManager, STATUS, ROLE, SPECIAL_ROLE, SPECIAL_ROLE_MIN_PLAYERS };
