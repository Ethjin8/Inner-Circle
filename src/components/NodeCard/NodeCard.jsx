import { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORY_COLORS = {
  family: '#f5a25b',
  friend: '#f3d24d',
  coworker: '#5fd496',
  classmate: '#7ea8ff',
  mentor: '#a884ff',
  romantic: '#f9a3c0',
  professional: '#f06d6d',
  other: '#bdc1c6',
};

const HOVER_DELAY_MS = 220;
const FADE_MS = 120;
const CARD_WIDTH = 240;
const ESTIMATED_HEIGHT = 140;
const OFFSET_X = 18;
const OFFSET_Y = -10;
const EDGE_PAD = 12;

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '?';
}

function formatLastContact(iso) {
  if (!iso) return 'no contact yet';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'no contact yet';
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function isBirthdayToday(iso) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export default function NodeCard({ hovered, people, categories }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const wasShownRef = useRef(false);

  // Track cursor while a node is hovered. If we go from "nothing hovered" to
  // "something hovered", wait HOVER_DELAY_MS before showing so quick passes
  // don't flicker. If switching directly from one node to another, swap content
  // immediately (no re-fade).
  useEffect(() => {
    if (!hovered) {
      setVisible(false);
      wasShownRef.current = false;
      return undefined;
    }
    const onMove = (e) => setPos({ x: e.clientX, y: e.clientY });
    document.addEventListener('mousemove', onMove);

    let timer = null;
    if (wasShownRef.current) {
      setVisible(true);
    } else {
      timer = setTimeout(() => {
        setVisible(true);
        wasShownRef.current = true;
      }, HOVER_DELAY_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('mousemove', onMove);
    };
  }, [hovered?.id]);

  const content = useMemo(() => {
    if (!hovered) return null;
    if (hovered.type === 'category') {
      const peeps = people.filter((p) => (p.relationship?.type || 'other') === hovered.category);
      const scored = peeps.filter((p) => p.relationship?.strength != null);
      const avg = scored.length
        ? Math.round(scored.reduce((s, p) => s + p.relationship.strength, 0) / scored.length)
        : null;
      const cat = categories?.find((c) => c.key === hovered.category);
      const label = cat?.label || hovered.category;
      return { kind: 'category', category: hovered.category, label, count: peeps.length, avg };
    }
    const person = people.find((p) => p.id === hovered.id);
    if (!person) return null;
    return { kind: 'person', person };
  }, [hovered, people, categories]);

  if (!hovered || !visible || !content) return null;

  // Edge-clamp: prefer above-and-right of cursor, flip sides if clipped.
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  let x = pos.x + OFFSET_X;
  let y = pos.y + OFFSET_Y;
  if (x + CARD_WIDTH > winW - EDGE_PAD) x = pos.x - CARD_WIDTH - OFFSET_X;
  if (y + ESTIMATED_HEIGHT > winH - EDGE_PAD) y = winH - ESTIMATED_HEIGHT - EDGE_PAD;
  if (y < EDGE_PAD) y = EDGE_PAD;
  if (x < EDGE_PAD) x = EDGE_PAD;

  const wrapStyle = {
    position: 'fixed',
    left: x,
    top: y,
    width: CARD_WIDTH,
    zIndex: 50,
    pointerEvents: 'none',
    background: 'rgba(15, 15, 18, 0.92)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: '12px 14px',
    color: 'rgba(255, 255, 255, 0.92)',
    fontFamily: '"Geist", system-ui, sans-serif',
    fontSize: 12.5,
    lineHeight: 1.4,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
    animation: `nodeCardFade ${FADE_MS}ms ease-out`,
  };

  if (content.kind === 'category') {
    const color = CATEGORY_COLORS[content.category] || CATEGORY_COLORS.other;
    return (
      <>
        <FadeKeyframes />
        <div style={wrapStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: '0 0 8px' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>
              {content.label}
            </span>
          </div>
          <div style={{ marginTop: 8, color: 'rgba(255, 255, 255, 0.65)', fontSize: 12 }}>
            {content.count} {content.count === 1 ? 'person' : 'people'}
            {content.avg != null && (
              <>
                {' · '}avg strength <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{content.avg}</span>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  const person = content.person;
  const cat = person.relationship?.type || 'other';
  const catEntry = categories?.find((c) => c.key === cat);
  const catLabel = catEntry?.label || cat;
  const color = catEntry?.color || CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
  const strength = person.relationship?.strength;
  const photo = person.profilePic?.secure_url;
  const last = formatLastContact(person.lastContactAt);
  const bday = isBirthdayToday(person.birthday);

  return (
    <>
      <FadeKeyframes />
      <div style={wrapStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {photo ? (
            <img
              src={photo}
              alt=""
              style={{
                width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                border: `1.5px solid ${color}`, flex: '0 0 40px',
              }}
            />
          ) : (
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%', flex: '0 0 40px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1.5px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, color: color,
              }}
            >
              {initialsOf(person.name)}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {person.name || 'Unnamed'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.6)' }}>
                {catLabel}
              </span>
            </div>
          </div>
        </div>

        {strength != null && (
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                fontSize: 11, color: 'rgba(255, 255, 255, 0.55)', marginBottom: 4,
              }}
            >
              <span>strength</span>
              <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(strength)}
              </span>
            </div>
            <div
              style={{
                height: 3, borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(2, Math.min(100, strength))}%`,
                  background: color,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 10, fontSize: 11.5, color: 'rgba(255, 255, 255, 0.6)',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}
        >
          <span>last contact: <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{last}</span></span>
          {bday && (
            <span
              style={{
                color: '#f9a3c0',
                background: 'rgba(249, 163, 192, 0.1)',
                padding: '1px 6px', borderRadius: 4, fontSize: 11,
              }}
            >
              🎂 today
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function FadeKeyframes() {
  return (
    <style>{`
      @keyframes nodeCardFade {
        from { opacity: 0; transform: translateY(2px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
