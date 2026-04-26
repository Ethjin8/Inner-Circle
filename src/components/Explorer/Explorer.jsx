import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, User, Calendar, Mail, Star } from 'lucide-react';
import './Explorer.css';

const CATEGORY_LABELS = {
  family: 'Family',
  friend: 'Friends',
  coworker: 'Work',
  classmate: 'School',
  mentor: 'Mentors',
  romantic: 'Romantic',
  professional: 'Professional',
  other: 'Other',
};

export default function Explorer({ people, onSelectPerson, isOpen, onClose }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set(['friend']));
  const [expandedPeople, setExpandedPeople] = useState(new Set());

  const groupedPeople = useMemo(() => {
    const groups = {};
    people.forEach(p => {
      const cat = p.relationship?.type || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    // Sort people within categories
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => a.name.localeCompare(b.name));
    });
    return groups;
  }, [people]);

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const togglePerson = (id) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <aside className="explorer-panel">
      <div className="explorer-header">
        <span className="explorer-title">EXPLORER</span>
        <button className="explorer-close" onClick={onClose}>×</button>
      </div>

      <div className="explorer-content">
        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
          const catPeople = groupedPeople[catKey] || [];
          if (catPeople.length === 0) return null;
          const isExpanded = expandedCategories.has(catKey);

          return (
            <div key={catKey} className="explorer-section">
              <div 
                className={`explorer-item category ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleCategory(catKey)}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={14} className="explorer-icon-folder" />
                <span className="explorer-item-label">{label}</span>
                <span className="explorer-count">{catPeople.length}</span>
              </div>

              {isExpanded && (
                <div className="explorer-children">
                  {catPeople.map(person => {
                    const isPersonExpanded = expandedPeople.has(person.id);
                    return (
                      <div key={person.id} className="explorer-person-wrap">
                        <div 
                          className={`explorer-item person ${isPersonExpanded ? 'expanded' : ''}`}
                          onClick={() => togglePerson(person.id)}
                        >
                          {isPersonExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <User size={12} className="explorer-icon-user" />
                          <span className="explorer-item-label" onClick={(e) => {
                            e.stopPropagation();
                            onSelectPerson(person);
                          }}>
                            {person.name}
                          </span>
                        </div>

                        {isPersonExpanded && (
                          <div className="explorer-info-tree">
                            <div className="explorer-info-item">
                              <Gift size={10} className="explorer-icon-birthday" />
                              <span>Strength: {Math.round(person.relationship?.strength || 0)}%</span>
                            </div>
                            {person.lastContactAt && (
                              <div className="explorer-info-item">
                                <Calendar size={10} />
                                <span>Last: {new Date(person.lastContactAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {person.email && (
                              <div className="explorer-info-item">
                                <Mail size={10} />
                                <span className="truncate">{person.email}</span>
                              </div>
                            )}
                            <div className="explorer-info-action" onClick={() => onSelectPerson(person)}>
                              View Full Profile
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
