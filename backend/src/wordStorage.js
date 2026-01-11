// Word Storage - Combines defaults (from Git) with custom additions (gitignored)
const fs = require('fs');
const path = require('path');
const { wordPairs: defaultWordPairs } = require('./wordDatabase');

// Custom words are stored separately and gitignored
const CUSTOM_FILE = path.join(__dirname, 'customWords.json');

// In-memory storage
let customPairs = [];           // User-added word pairs
let deletedDefaultIndices = []; // Indices of default pairs that were removed
let modifiedDefaults = {};      // Map of default index -> modified pair data
let nextCustomId = 100000;      // Start custom IDs high to avoid collision with defaults

// Initialize - load custom data from file
function initWordStorage() {
  try {
    if (fs.existsSync(CUSTOM_FILE)) {
      const data = JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf-8'));
      customPairs = data.customPairs || [];
      deletedDefaultIndices = data.deletedDefaultIndices || [];
      modifiedDefaults = data.modifiedDefaults || {};
      nextCustomId = data.nextCustomId || 100000;
      console.log(`Loaded ${customPairs.length} custom word pairs, ${deletedDefaultIndices.length} deleted defaults`);
    } else {
      console.log(`Using ${defaultWordPairs.length} default word pairs (no custom file found)`);
    }
  } catch (error) {
    console.error('Error loading custom word storage:', error);
  }
}

// Save custom data to file
function saveCustomFile() {
  try {
    fs.writeFileSync(CUSTOM_FILE, JSON.stringify({
      customPairs,
      deletedDefaultIndices,
      modifiedDefaults,
      nextCustomId
    }, null, 2));
  } catch (error) {
    console.error('Error saving custom word storage:', error);
  }
}

// Get combined word pairs (defaults + custom, minus deleted)
function getAllWordPairs() {
  const combined = [];
  
  // Add defaults (minus deleted, with modifications applied)
  defaultWordPairs.forEach((pair, index) => {
    if (!deletedDefaultIndices.includes(index)) {
      const modified = modifiedDefaults[index];
      combined.push({
        id: index + 1, // Default IDs are 1-based index
        civ: modified?.civ ?? pair.civ,
        und: modified?.und ?? pair.und,
        cat: modified?.cat ?? pair.cat,
        isDefault: true
      });
    }
  });
  
  // Add custom pairs
  customPairs.forEach(pair => {
    combined.push({
      ...pair,
      isDefault: false
    });
  });
  
  return combined;
}

// Get word pairs by category
function getWordPairsByCategory(category) {
  return getAllWordPairs().filter(p => p.cat === category);
}

// Get all categories with counts
function getAllCategories() {
  const allPairs = getAllWordPairs();
  const counts = {};
  allPairs.forEach(p => {
    counts[p.cat] = (counts[p.cat] || 0) + 1;
  });
  return Object.keys(counts).map(cat => ({
    name: cat,
    count: counts[cat]
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Get random word pair (optionally filtered by categories)
// Randomly swaps civ/und to prevent memorization of which word is which role
function getRandomWordPair(selectedCategories = null) {
  let filtered = getAllWordPairs();
  if (selectedCategories && selectedCategories.length > 0) {
    filtered = filtered.filter(p => selectedCategories.includes(p.cat));
  }
  if (filtered.length === 0) {
    filtered = getAllWordPairs();
  }
  const index = Math.floor(Math.random() * filtered.length);
  const pair = filtered[index];
  
  // 50% chance to swap civilian and undercover words
  const shouldSwap = Math.random() < 0.5;
  if (shouldSwap) {
    return {
      ...pair,
      civ: pair.und,
      und: pair.civ
    };
  }
  return pair;
}

// Add a new word pair (always goes to custom)
function addWordPair(civ, und, cat) {
  const newPair = {
    id: nextCustomId++,
    civ: civ.trim(),
    und: und.trim(),
    cat: cat.trim()
  };
  customPairs.push(newPair);
  saveCustomFile();
  return newPair;
}

// Update a word pair
function updateWordPair(id, updates) {
  // Check if it's a default pair (ID < 100000)
  if (id < 100000) {
    const defaultIndex = id - 1;
    if (defaultIndex < 0 || defaultIndex >= defaultWordPairs.length) return null;
    if (deletedDefaultIndices.includes(defaultIndex)) return null;
    
    // Store modification
    const original = defaultWordPairs[defaultIndex];
    const existing = modifiedDefaults[defaultIndex] || {};
    modifiedDefaults[defaultIndex] = {
      civ: updates.civ?.trim() ?? existing.civ ?? original.civ,
      und: updates.und?.trim() ?? existing.und ?? original.und,
      cat: updates.cat?.trim() ?? existing.cat ?? original.cat
    };
    saveCustomFile();
    return {
      id,
      ...modifiedDefaults[defaultIndex],
      isDefault: true
    };
  }
  
  // Custom pair
  const index = customPairs.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  if (updates.civ !== undefined) customPairs[index].civ = updates.civ.trim();
  if (updates.und !== undefined) customPairs[index].und = updates.und.trim();
  if (updates.cat !== undefined) customPairs[index].cat = updates.cat.trim();
  
  saveCustomFile();
  return customPairs[index];
}

// Delete a word pair
function deleteWordPair(id) {
  // Check if it's a default pair (ID < 100000)
  if (id < 100000) {
    const defaultIndex = id - 1;
    if (defaultIndex < 0 || defaultIndex >= defaultWordPairs.length) return false;
    if (deletedDefaultIndices.includes(defaultIndex)) return false;
    
    // Mark as deleted
    deletedDefaultIndices.push(defaultIndex);
    // Also remove any modifications
    delete modifiedDefaults[defaultIndex];
    saveCustomFile();
    return true;
  }
  
  // Custom pair
  const index = customPairs.findIndex(p => p.id === id);
  if (index === -1) return false;
  
  customPairs.splice(index, 1);
  saveCustomFile();
  return true;
}

// Rename a category (affects both defaults and custom)
function renameCategory(oldName, newName) {
  let count = 0;
  const trimmedNew = newName.trim();
  
  // Rename in defaults (via modifications)
  defaultWordPairs.forEach((pair, index) => {
    if (!deletedDefaultIndices.includes(index)) {
      const current = modifiedDefaults[index]?.cat ?? pair.cat;
      if (current === oldName) {
        modifiedDefaults[index] = {
          ...(modifiedDefaults[index] || {}),
          civ: modifiedDefaults[index]?.civ ?? pair.civ,
          und: modifiedDefaults[index]?.und ?? pair.und,
          cat: trimmedNew
        };
        count++;
      }
    }
  });
  
  // Rename in custom pairs
  customPairs.forEach(p => {
    if (p.cat === oldName) {
      p.cat = trimmedNew;
      count++;
    }
  });
  
  if (count > 0) saveCustomFile();
  return count;
}

// Delete a category (and all its word pairs)
function deleteCategory(name) {
  let deleted = 0;
  
  // Mark defaults with this category as deleted
  defaultWordPairs.forEach((pair, index) => {
    if (!deletedDefaultIndices.includes(index)) {
      const current = modifiedDefaults[index]?.cat ?? pair.cat;
      if (current === name) {
        deletedDefaultIndices.push(index);
        delete modifiedDefaults[index];
        deleted++;
      }
    }
  });
  
  // Remove custom pairs with this category
  const beforeCustom = customPairs.length;
  customPairs = customPairs.filter(p => p.cat !== name);
  deleted += beforeCustom - customPairs.length;
  
  if (deleted > 0) saveCustomFile();
  return deleted;
}

// Add multiple word pairs at once (bulk import - all go to custom)
function addBulkWordPairs(pairs) {
  const added = [];
  for (const pair of pairs) {
    if (pair.civ && pair.und && pair.cat) {
      const newPair = {
        id: nextCustomId++,
        civ: pair.civ.trim(),
        und: pair.und.trim(),
        cat: pair.cat.trim()
      };
      customPairs.push(newPair);
      added.push(newPair);
    }
  }
  if (added.length > 0) saveCustomFile();
  return added;
}

// Reset - clears all custom modifications (restores pure defaults)
function resetToDefaults() {
  customPairs = [];
  deletedDefaultIndices = [];
  modifiedDefaults = {};
  nextCustomId = 100000;
  
  // Delete the custom file
  try {
    if (fs.existsSync(CUSTOM_FILE)) {
      fs.unlinkSync(CUSTOM_FILE);
    }
  } catch (error) {
    console.error('Error deleting custom file:', error);
  }
  
  return defaultWordPairs.length;
}

// Get total count
function getTotalPairs() {
  return getAllWordPairs().length;
}

// Initialize on module load
initWordStorage();

module.exports = {
  getAllWordPairs,
  getWordPairsByCategory,
  getAllCategories,
  getRandomWordPair,
  addWordPair,
  updateWordPair,
  deleteWordPair,
  renameCategory,
  deleteCategory,
  addBulkWordPairs,
  resetToDefaults,
  getTotalPairs
};
