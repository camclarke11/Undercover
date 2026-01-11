// Word Storage - Manages word pairs with persistence to JSON file
const fs = require('fs');
const path = require('path');
const { wordPairs: defaultWordPairs } = require('./wordDatabase');

const DATA_FILE = path.join(__dirname, 'customWords.json');

// In-memory storage
let wordPairs = [];
let nextId = 1;

// Initialize from file or defaults
function initWordStorage() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      wordPairs = data.wordPairs || [];
      nextId = data.nextId || 1;
      console.log(`Loaded ${wordPairs.length} word pairs from storage`);
    } else {
      // Initialize with default word pairs
      wordPairs = defaultWordPairs.map((pair, index) => ({
        id: index + 1,
        civ: pair.civ,
        und: pair.und,
        cat: pair.cat
      }));
      nextId = wordPairs.length + 1;
      saveToFile();
      console.log(`Initialized ${wordPairs.length} default word pairs`);
    }
  } catch (error) {
    console.error('Error loading word storage:', error);
    // Fallback to defaults
    wordPairs = defaultWordPairs.map((pair, index) => ({
      id: index + 1,
      civ: pair.civ,
      und: pair.und,
      cat: pair.cat
    }));
    nextId = wordPairs.length + 1;
  }
}

// Save to file
function saveToFile() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ wordPairs, nextId }, null, 2));
  } catch (error) {
    console.error('Error saving word storage:', error);
  }
}

// Get all word pairs
function getAllWordPairs() {
  return wordPairs;
}

// Get word pairs by category
function getWordPairsByCategory(category) {
  return wordPairs.filter(p => p.cat === category);
}

// Get all categories with counts
function getAllCategories() {
  const counts = {};
  wordPairs.forEach(p => {
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
  let filtered = wordPairs;
  if (selectedCategories && selectedCategories.length > 0) {
    filtered = wordPairs.filter(p => selectedCategories.includes(p.cat));
  }
  if (filtered.length === 0) {
    filtered = wordPairs;
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

// Add a new word pair
function addWordPair(civ, und, cat) {
  const newPair = {
    id: nextId++,
    civ: civ.trim(),
    und: und.trim(),
    cat: cat.trim()
  };
  wordPairs.push(newPair);
  saveToFile();
  return newPair;
}

// Update a word pair
function updateWordPair(id, updates) {
  const index = wordPairs.findIndex(p => p.id === id);
  if (index === -1) return null;
  
  if (updates.civ !== undefined) wordPairs[index].civ = updates.civ.trim();
  if (updates.und !== undefined) wordPairs[index].und = updates.und.trim();
  if (updates.cat !== undefined) wordPairs[index].cat = updates.cat.trim();
  
  saveToFile();
  return wordPairs[index];
}

// Delete a word pair
function deleteWordPair(id) {
  const index = wordPairs.findIndex(p => p.id === id);
  if (index === -1) return false;
  
  wordPairs.splice(index, 1);
  saveToFile();
  return true;
}

// Rename a category
function renameCategory(oldName, newName) {
  let count = 0;
  wordPairs.forEach(p => {
    if (p.cat === oldName) {
      p.cat = newName.trim();
      count++;
    }
  });
  if (count > 0) saveToFile();
  return count;
}

// Delete a category (and all its word pairs)
function deleteCategory(name) {
  const before = wordPairs.length;
  wordPairs = wordPairs.filter(p => p.cat !== name);
  const deleted = before - wordPairs.length;
  if (deleted > 0) saveToFile();
  return deleted;
}

// Add multiple word pairs at once (bulk import)
function addBulkWordPairs(pairs) {
  const added = [];
  for (const pair of pairs) {
    if (pair.civ && pair.und && pair.cat) {
      const newPair = {
        id: nextId++,
        civ: pair.civ.trim(),
        und: pair.und.trim(),
        cat: pair.cat.trim()
      };
      wordPairs.push(newPair);
      added.push(newPair);
    }
  }
  if (added.length > 0) saveToFile();
  return added;
}

// Reset to default word pairs
function resetToDefaults() {
  wordPairs = defaultWordPairs.map((pair, index) => ({
    id: index + 1,
    civ: pair.civ,
    und: pair.und,
    cat: pair.cat
  }));
  nextId = wordPairs.length + 1;
  saveToFile();
  return wordPairs.length;
}

// Get total count
function getTotalPairs() {
  return wordPairs.length;
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
