import { useState, useCallback } from 'react';
import StarField from './components/Graph/StarField';
import ConstellationGraph from './components/Graph/ConstellationGraph';
import PersonModal from './components/PersonModal/PersonModal';
import AddPersonModal from './components/AddPersonModal/AddPersonModal';
import './App.css';

const FILTERS = [
  { key: null, label: 'All' },
  { key: 'family', label: 'Family', color: '#e8b06b' },
  { key: 'friend', label: 'Friends', color: '#ffce5c' },
  { key: 'classmate', label: 'School', color: '#b9d0ff' },
  { key: 'coworker', label: 'Work', color: '#9be6c4' },
  { key: 'professional', label: 'Professional', color: '#ff9c5a' },
  { key: 'romantic', label: 'Romantic', color: '#ffc8d6' },
  { key: 'mentor', label: 'Mentors', color: '#7df9ff' },
];

const CATEGORY_COLORS = {
  family: '#e8b06b',
  friend: '#ffce5c',
  classmate: '#b9d0ff',
  coworker: '#9be6c4',
  professional: '#ff9c5a',
  romantic: '#ffc8d6',
  mentor: '#7df9ff',
};

function App() {
  const [activeFilter, setActiveFilter] = useState(null);
  const [attachedNodes, setAttachedNodes] = useState([]);
  const [promptText, setPromptText] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);

  const handleNodeClick = useCallback((node) => {
    setSelectedPerson(node);
  }, []);

  const handleNodeDoubleClick = useCallback((node) => {
    setAttachedNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) return prev;
      return [...prev, node];
    });
  }, []);

  const removeAttachedNode = useCallback((nodeId) => {
    setAttachedNodes((prev) => prev.filter((n) => n.id !== nodeId));
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!promptText.trim() && attachedNodes.length === 0) return;
    setPromptText('');
    setAttachedNodes([]);
  }, [promptText, attachedNodes]);

  return (
    <div className="app">
      <StarField />

      <header className="header">
        <div className="logo">
          <span className="logo-text">Inner Circle</span>
        </div>

        <div className="header-actions">
          <button className="btn-primary" onClick={() => setAddPersonOpen(true)}>+ Add Person</button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-label">Categories</div>
        {FILTERS.map((f) => (
          <button
            key={f.key ?? 'all'}
            className={`sidebar-chip ${activeFilter === f.key ? 'active' : 'inactive'}`}
            onClick={() => setActiveFilter(f.key === activeFilter ? null : f.key)}
          >
            {f.color && (
              <span className="filter-dot" style={{ background: f.color }} />
            )}
            {f.label}
          </button>
        ))}
      </aside>

      <div className="graph-container">
        <ConstellationGraph
          activeFilter={activeFilter}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      </div>

      <div className="prompt-area">
        {attachedNodes.length > 0 && (
          <div className="attached-nodes">
            {attachedNodes.map((node) => (
              <span
                key={node.id}
                className="attached-chip"
                style={{ borderColor: CATEGORY_COLORS[node.category] || '#94a3b8' }}
              >
                <span
                  className="attached-chip-dot"
                  style={{ background: CATEGORY_COLORS[node.category] || '#94a3b8' }}
                />
                {node.name}
                <button
                  className="attached-chip-remove"
                  onClick={() => removeAttachedNode(node.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <form className="prompt-form" onSubmit={handleSubmit}>
          <input
            className="prompt-input"
            type="text"
            placeholder="Ask about your connections..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <button
            className="prompt-submit"
            type="submit"
            disabled={!promptText.trim() && attachedNodes.length === 0}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
        <div className="prompt-hint">Click a node to view details — double-click to attach as context</div>
      </div>

      <PersonModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />
      <AddPersonModal open={addPersonOpen} onClose={() => setAddPersonOpen(false)} />
    </div>
  );
}

export default App;
