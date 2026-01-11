import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function Lobby() {
  const { room, addPlayer, removePlayer, updateSettings, startGame, leaveRoom, error, clearError, categories, categoriesLoading } = useSocket();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const settings = room?.settings || { undercoverCount: 1, includeMrWhite: false, selectedCategories: [] };
  const playerCount = room?.players?.length || 0;
  const selectedCategories = settings.selectedCategories || [];
  const allCategoryNames = categories.map(c => c.name);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setAddingPlayer(true);
    clearError();
    try {
      await addPlayer(newPlayerName.trim());
      setNewPlayerName('');
    } catch (err) {
      console.error('Failed to add player:', err);
    }
    setAddingPlayer(false);
  };

  const handleRemovePlayer = async (playerId) => {
    try {
      await removePlayer(playerId);
    } catch (err) {
      console.error('Failed to remove player:', err);
    }
  };

  const handleUpdateUndercoverCount = async (delta) => {
    const newCount = Math.max(1, Math.min(4, settings.undercoverCount + delta));
    if (newCount !== settings.undercoverCount) {
      try {
        await updateSettings({ undercoverCount: newCount });
      } catch (err) {
        console.error('Failed to update settings:', err);
      }
    }
  };

  const handleToggleMrWhite = async () => {
    try {
      await updateSettings({ includeMrWhite: !settings.includeMrWhite });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleToggleCategory = async (categoryName) => {
    const isSelected = selectedCategories.includes(categoryName);
    const newCategories = isSelected
      ? selectedCategories.filter(c => c !== categoryName)
      : [...selectedCategories, categoryName];
    
    try {
      await updateSettings({ selectedCategories: newCategories });
    } catch (err) {
      console.error('Failed to update categories:', err);
    }
  };

  const handleSelectAllCategories = async () => {
    try {
      await updateSettings({ selectedCategories: allCategoryNames });
    } catch (err) {
      console.error('Failed to update categories:', err);
    }
  };

  const handleClearCategories = async () => {
    try {
      await updateSettings({ selectedCategories: [] });
    } catch (err) {
      console.error('Failed to update categories:', err);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    clearError();
    try {
      await startGame();
    } catch (err) {
      console.error('Failed to start game:', err);
    }
    setLoading(false);
  };

  const handleLeave = () => {
    leaveRoom();
  };

  // Calculate role distribution
  const undercoverCount = settings.undercoverCount;
  const mrWhiteCount = settings.includeMrWhite ? 1 : 0;
  const civilianCount = Math.max(0, playerCount - undercoverCount - mrWhiteCount);
  const hasCategories = selectedCategories.length > 0;
  const isValidConfig = playerCount >= 3 && civilianCount >= 2 && hasCategories;

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handleLeave}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Game Setup</h1>
        <div className="w-6" />
      </div>

      {/* Add Player Form */}
      <form onSubmit={handleAddPlayer} className="card mb-4">
        <p className="text-sm text-gray-400 mb-3">Add players:</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Player name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="input-field flex-1"
            maxLength={20}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={addingPlayer || !newPlayerName.trim()}
            className="px-4 py-3 bg-game-success text-black font-semibold rounded-xl hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {addingPlayer ? '...' : '+'}
          </button>
        </div>
      </form>

      {/* Players List */}
      <div className="card mb-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Players</h2>
          <span className="text-sm text-gray-400">{playerCount}/12</span>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {room?.players?.map((player, index) => (
            <div
              key={player.id}
              className="player-chip"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-game-highlight flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>
                <span className="font-medium">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs text-game-warning">(Host)</span>
                )}
              </div>
              {!player.isHost && (
                <button
                  onClick={() => handleRemovePlayer(player.id)}
                  className="text-gray-400 hover:text-game-highlight transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {playerCount < 3 && (
          <p className="text-center text-gray-400 text-sm mt-3">
            Need {3 - playerCount} more player{3 - playerCount > 1 ? 's' : ''} to start
          </p>
        )}
      </div>

      {/* Game Settings */}
      <div className="card mb-4">
        <h2 className="font-semibold mb-4">Game Settings</h2>
        
        {/* Undercover Count */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-white">Undercover Agents</p>
            <p className="text-xs text-gray-400">Players with a different word</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleUpdateUndercoverCount(-1)}
              disabled={settings.undercoverCount <= 1}
              className="w-8 h-8 rounded-lg bg-game-accent text-white font-bold hover:bg-game-highlight transition-colors disabled:opacity-30"
            >
              −
            </button>
            <span className="w-6 text-center font-bold text-lg">{settings.undercoverCount}</span>
            <button
              onClick={() => handleUpdateUndercoverCount(1)}
              disabled={settings.undercoverCount >= 4}
              className="w-8 h-8 rounded-lg bg-game-accent text-white font-bold hover:bg-game-highlight transition-colors disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        {/* Mr. White Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-white">Include Mr. White</p>
            <p className="text-xs text-gray-400">One player with no word at all</p>
          </div>
          <button
            onClick={handleToggleMrWhite}
            className={`w-14 h-8 rounded-full transition-colors relative ${
              settings.includeMrWhite ? 'bg-game-success' : 'bg-game-accent'
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                settings.includeMrWhite ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Prevent Mr. White First Toggle (only if Mr. White is enabled) */}
        {settings.includeMrWhite && (
          <div className="flex items-center justify-between mt-4 pl-4 border-l-2 border-gray-700">
            <div>
              <p className="font-medium text-white">Fair Start</p>
              <p className="text-xs text-gray-400">Mr. White won't go first</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await updateSettings({ preventMrWhiteFirst: !settings.preventMrWhiteFirst });
                } catch (err) {
                  console.error('Failed to update settings:', err);
                }
              }}
              className={`w-14 h-8 rounded-full transition-colors relative ${
                settings.preventMrWhiteFirst ? 'bg-game-success' : 'bg-game-accent'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                  settings.preventMrWhiteFirst ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        )}

        {/* Hide Roles Toggle */}
        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="font-medium text-white">Blind Mode</p>
            <p className="text-xs text-gray-400">Players won't know if they are Civilian or Undercover</p>
          </div>
          <button
            onClick={async () => {
              try {
                await updateSettings({ hideRoleLabels: !settings.hideRoleLabels });
              } catch (err) {
                console.error('Failed to update settings:', err);
              }
            }}
            className={`w-14 h-8 rounded-full transition-colors relative ${
              settings.hideRoleLabels ? 'bg-game-success' : 'bg-game-accent'
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                settings.hideRoleLabels ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Category Selection */}
      <div className="card mb-4">
        <button 
          onClick={() => setShowCategories(!showCategories)}
          className="w-full flex items-center justify-between"
        >
          <div>
            <h2 className="font-semibold text-left">Word Categories</h2>
            <p className={`text-xs ${selectedCategories.length === 0 ? 'text-game-highlight' : 'text-gray-400'}`}>
              {selectedCategories.length === 0
                ? '⚠️ No categories selected!'
                : selectedCategories.length === allCategoryNames.length 
                  ? 'All categories selected' 
                  : `${selectedCategories.length} of ${allCategoryNames.length} selected`}
            </p>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${showCategories ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showCategories && (
          <div className="mt-4">
            {/* Select All / Clear All buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleSelectAllCategories}
                disabled={selectedCategories.length === allCategoryNames.length}
                className="flex-1 py-2 px-3 text-sm font-medium rounded-lg bg-game-success bg-opacity-20 text-game-success hover:bg-opacity-30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✓ Select All
              </button>
              <button
                onClick={handleClearCategories}
                disabled={selectedCategories.length === 0}
                className="flex-1 py-2 px-3 text-sm font-medium rounded-lg bg-game-highlight bg-opacity-20 text-game-highlight hover:bg-opacity-30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✕ Clear All
              </button>
            </div>

            {/* Category checkboxes */}
            {categoriesLoading ? (
              <div className="text-center text-gray-400 py-4">Loading categories...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {categories.map((category) => {
                  const isSelected = selectedCategories.includes(category.name);
                  return (
                    <button
                      key={category.name}
                      onClick={() => handleToggleCategory(category.name)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        isSelected 
                          ? 'bg-game-success bg-opacity-20 border-2 border-game-success' 
                          : 'bg-game-accent border-2 border-transparent hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 ${
                          isSelected ? 'bg-game-success text-black' : 'bg-gray-600'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                            {category.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {category.count} pairs
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected count summary */}
            <div className="mt-3 pt-3 border-t border-gray-700 text-center">
              {selectedCategories.length === 0 ? (
                <p className="text-xs text-game-highlight">
                  ⚠️ Select at least one category to start
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  📝 {categories.filter(c => selectedCategories.includes(c.name)).reduce((sum, c) => sum + c.count, 0)} word pairs available
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Role Distribution Preview */}
      <div className="card mb-4">
        <p className="text-sm text-gray-400 mb-2">Role Distribution:</p>
        <div className="flex justify-center gap-4 text-sm">
          <div className="text-center">
            <span className="text-2xl">👤</span>
            <p className="text-game-success font-medium">{civilianCount} Civilian{civilianCount !== 1 ? 's' : ''}</p>
          </div>
          <div className="text-center">
            <span className="text-2xl">🕵️</span>
            <p className="text-game-highlight font-medium">{undercoverCount} Undercover</p>
          </div>
          {mrWhiteCount > 0 && (
            <div className="text-center">
              <span className="text-2xl">🎭</span>
              <p className="text-game-warning font-medium">{mrWhiteCount} Mr. White</p>
            </div>
          )}
        </div>
        {!isValidConfig && playerCount >= 3 && (
          <p className="text-center text-game-highlight text-xs mt-2">
            ⚠️ Need at least 2 civilians - reduce special roles
          </p>
        )}
      </div>

      {/* Leaderboard Preview (if games have been played) */}
      {room?.gamesPlayedTotal > 0 && room?.leaderboard?.length > 0 && (
        <div className="card mb-4">
          <p className="text-sm text-gray-400 mb-2 text-center">🏆 Current Standings</p>
          <div className="flex justify-center gap-4">
            {room.leaderboard.slice(0, 3).map((player, idx) => (
              <div key={player.id} className="text-center">
                <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center font-bold text-sm ${
                  idx === 0 ? 'bg-game-warning text-black' :
                  idx === 1 ? 'bg-gray-400 text-black' :
                  'bg-amber-700 text-white'
                }`}>
                  {idx + 1}
                </div>
                <p className="text-xs text-white mt-1 truncate max-w-16">{player.name}</p>
                <p className="text-xs text-game-success font-bold">{player.score}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            {room.gamesPlayedTotal} game{room.gamesPlayedTotal !== 1 ? 's' : ''} played
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-game-highlight bg-opacity-20 border border-game-highlight rounded-xl text-center text-sm mb-4">
          {error}
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={loading || !isValidConfig}
        className="btn-primary mt-auto"
      >
        {loading ? 'Starting...' : `Start Game (${playerCount} players)`}
      </button>
    </div>
  );
}
