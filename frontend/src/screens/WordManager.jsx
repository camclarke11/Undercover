import React, { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export default function WordManager({ onBack }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showAddWord, setShowAddWord] = useState(false);
  const [showEditWord, setShowEditWord] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showRenameCategory, setShowRenameCategory] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Form states
  const [formCiv, setFormCiv] = useState('');
  const [formUnd, setFormUnd] = useState('');
  const [formCat, setFormCat] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories');
    }
  }, []);

  // Fetch words for a category
  const fetchWords = useCallback(async (category = null) => {
    try {
      setLoading(true);
      const url = category 
        ? `${BACKEND_URL}/api/words?category=${encodeURIComponent(category)}`
        : `${BACKEND_URL}/api/words`;
      const res = await fetch(url);
      const data = await res.json();
      setWords(data.pairs || []);
    } catch (err) {
      console.error('Failed to fetch words:', err);
      setError('Failed to load words');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchWords();
  }, [fetchCategories, fetchWords]);

  // Select category
  const handleSelectCategory = (cat) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
      fetchWords();
    } else {
      setSelectedCategory(cat);
      fetchWords(cat);
    }
  };

  // Add word
  const handleAddWord = async () => {
    if (!formCiv.trim() || !formUnd.trim() || !formCat.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ civ: formCiv, und: formUnd, cat: formCat })
      });
      if (res.ok) {
        setShowAddWord(false);
        setFormCiv('');
        setFormUnd('');
        setFormCat('');
        fetchCategories();
        fetchWords(selectedCategory);
      }
    } catch (err) {
      console.error('Failed to add word:', err);
    }
  };

  // Edit word
  const handleEditWord = async () => {
    if (!showEditWord || !formCiv.trim() || !formUnd.trim() || !formCat.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/words/${showEditWord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ civ: formCiv, und: formUnd, cat: formCat })
      });
      if (res.ok) {
        setShowEditWord(null);
        setFormCiv('');
        setFormUnd('');
        setFormCat('');
        fetchCategories();
        fetchWords(selectedCategory);
      }
    } catch (err) {
      console.error('Failed to edit word:', err);
    }
  };

  // Delete word
  const handleDeleteWord = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/words/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowDeleteConfirm(null);
        fetchCategories();
        fetchWords(selectedCategory);
      }
    } catch (err) {
      console.error('Failed to delete word:', err);
    }
  };

  // Rename category
  const handleRenameCategory = async () => {
    if (!showRenameCategory || !newCategoryName.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/categories/${encodeURIComponent(showRenameCategory)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newCategoryName })
      });
      if (res.ok) {
        setShowRenameCategory(null);
        setNewCategoryName('');
        if (selectedCategory === showRenameCategory) {
          setSelectedCategory(newCategoryName);
        }
        fetchCategories();
        fetchWords(selectedCategory === showRenameCategory ? newCategoryName : selectedCategory);
      }
    } catch (err) {
      console.error('Failed to rename category:', err);
    }
  };

  // Delete category
  const handleDeleteCategory = async (name) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/categories/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowDeleteConfirm(null);
        if (selectedCategory === name) {
          setSelectedCategory(null);
        }
        fetchCategories();
        fetchWords(null);
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Reset to defaults
  const handleReset = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/words/reset`, {
        method: 'POST'
      });
      if (res.ok) {
        setShowResetConfirm(false);
        setSelectedCategory(null);
        fetchCategories();
        fetchWords();
      }
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  // Open edit modal
  const openEditModal = (word) => {
    setFormCiv(word.civ);
    setFormUnd(word.und);
    setFormCat(word.cat);
    setShowEditWord(word);
  };

  // Open add modal
  const openAddModal = () => {
    setFormCiv('');
    setFormUnd('');
    setFormCat(selectedCategory || '');
    setShowAddWord(true);
  };

  return (
    <div className="min-h-screen flex flex-col p-4 safe-bottom">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-xl">←</span>
          <span>Back</span>
        </button>
        <h1 className="text-xl font-bold text-white">⚙️ Word Manager</h1>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="text-sm text-game-highlight hover:underline"
        >
          Reset
        </button>
      </div>

      {error && (
        <div className="bg-game-highlight bg-opacity-20 p-3 rounded-xl mb-4 text-center text-sm">
          {error}
        </div>
      )}

      {/* Categories */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm text-gray-400 font-medium">Categories</h2>
          <span className="text-xs text-gray-500">{categories.length} categories</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <div key={cat.name} className="relative group">
              <button
                onClick={() => handleSelectCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  selectedCategory === cat.name
                    ? 'bg-game-success text-white'
                    : 'bg-game-accent text-gray-300 hover:bg-opacity-70'
                }`}
              >
                {cat.name} <span className="text-xs opacity-60">({cat.count})</span>
              </button>
              {/* Category actions on hover */}
              <div className="absolute -top-8 left-0 hidden group-hover:flex gap-1 bg-game-card rounded-lg p-1 shadow-lg z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRenameCategory(cat.name); setNewCategoryName(cat.name); }}
                  className="text-xs px-2 py-1 bg-game-accent rounded hover:bg-opacity-70"
                  title="Rename"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm({ type: 'category', name: cat.name, count: cat.count }); }}
                  className="text-xs px-2 py-1 bg-game-highlight rounded hover:bg-opacity-70"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm text-gray-400 font-medium">
            {selectedCategory ? `Words in "${selectedCategory}"` : 'All Words'}
          </h2>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1 px-3 py-1.5 bg-game-success rounded-full text-sm hover:bg-opacity-80 transition-colors"
          >
            <span>+</span> Add Word
          </button>
        </div>

          {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-4">
            {words.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No word pairs found. Add some!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {words.map(word => (
                  <div
                    key={word.id}
                    className="bg-game-accent rounded-lg p-2 flex flex-col justify-between group hover:bg-opacity-80 transition-all text-sm"
                  >
                    <div className="min-w-0 mb-1">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <span className="text-white font-medium truncate">{word.civ}</span>
                        <span className="text-gray-500 text-xs">↔</span>
                        <span className="text-white font-medium truncate">{word.und}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] text-gray-500 bg-black bg-opacity-20 px-1.5 py-0.5 rounded-full">{word.cat}</span>
                      </div>
                    </div>
                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      <button
                        onClick={() => openEditModal(word)}
                        className="p-1 bg-game-card rounded hover:bg-opacity-70"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm({ type: 'word', id: word.id, civ: word.civ, und: word.und })}
                        className="p-1 bg-game-highlight bg-opacity-50 rounded hover:bg-opacity-70"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Word Modal */}
      {showAddWord && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Add Word Pair</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Word 1</label>
                <input
                  type="text"
                  value={formCiv}
                  onChange={(e) => setFormCiv(e.target.value)}
                  className="input-field text-left"
                  placeholder="e.g. Apple"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Word 2</label>
                <input
                  type="text"
                  value={formUnd}
                  onChange={(e) => setFormUnd(e.target.value)}
                  className="input-field text-left"
                  placeholder="e.g. Pear"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <input
                  type="text"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                  className="input-field text-left"
                  placeholder="e.g. Food & Drink"
                  list="category-list"
                />
                <datalist id="category-list">
                  {categories.map(c => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddWord(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWord}
                disabled={!formCiv.trim() || !formUnd.trim() || !formCat.trim()}
                className="btn-primary flex-1"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Word Modal */}
      {showEditWord && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Edit Word Pair</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Word 1</label>
                <input
                  type="text"
                  value={formCiv}
                  onChange={(e) => setFormCiv(e.target.value)}
                  className="input-field text-left"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Word 2</label>
                <input
                  type="text"
                  value={formUnd}
                  onChange={(e) => setFormUnd(e.target.value)}
                  className="input-field text-left"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <input
                  type="text"
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                  className="input-field text-left"
                  list="category-list-edit"
                />
                <datalist id="category-list-edit">
                  {categories.map(c => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditWord(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleEditWord}
                disabled={!formCiv.trim() || !formUnd.trim() || !formCat.trim()}
                className="btn-primary flex-1"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Category Modal */}
      {showRenameCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Rename Category</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="input-field text-left"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRenameCategory(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameCategory}
                disabled={!newCategoryName.trim()}
                className="btn-primary flex-1"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm text-center">
            <h2 className="text-xl font-bold mb-4">
              {showDeleteConfirm.type === 'category' ? '🗑️ Delete Category?' : '🗑️ Delete Word Pair?'}
            </h2>
            <p className="text-gray-400 mb-6">
              {showDeleteConfirm.type === 'category'
                ? `This will delete "${showDeleteConfirm.name}" and all ${showDeleteConfirm.count} word pairs in it.`
                : `Delete "${showDeleteConfirm.civ}" ↔ "${showDeleteConfirm.und}"?`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'category') {
                    handleDeleteCategory(showDeleteConfirm.name);
                  } else {
                    handleDeleteWord(showDeleteConfirm.id);
                  }
                }}
                className="btn-primary flex-1 bg-game-highlight"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm text-center">
            <h2 className="text-xl font-bold mb-4">🔄 Reset to Defaults?</h2>
            <p className="text-gray-400 mb-6">
              This will delete all custom word pairs and restore the original defaults. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="btn-primary flex-1 bg-game-highlight"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
