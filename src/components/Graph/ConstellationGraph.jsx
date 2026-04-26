import { useRef, useEffect, useCallback, useMemo } from 'react';

// Pan momentum after release. Higher = longer glide. Range ~0.85–0.97.
const PAN_INERTIA_DECAY = 0.92;
const PAN_INERTIA_MIN_VELOCITY = 0.1;

// Spread evenly around the hue wheel (~50° apart) so adjacent categories never
// look alike: red, orange, yellow, green, blue, violet, pink, plus neutral.
const CATEGORIES = {
  family:       { color: '#f5a25b' }, // amber       (hue ~28°)
  friend:       { color: '#f3d24d' }, // yellow      (hue ~50°)
  coworker:     { color: '#5fd496' }, // green       (hue ~145°)
  classmate:    { color: '#7ea8ff' }, // blue        (hue ~218°)
  mentor:       { color: '#a884ff' }, // violet      (hue ~258°)
  romantic:     { color: '#f9a3c0' }, // pink        (hue ~335°)
  professional: { color: '#f06d6d' }, // coral red   (hue ~0°)
  other:        { color: '#bdc1c6' }, // neutral
};


function daysSince(iso) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function isBirthdayToday(iso) {
  if (!iso) return false;
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getMonth() === today.getMonth() && Math.abs(d.getDate() - today.getDate()) <= 1;
}

// Single source of truth for graph centering and overall spread.
// Reserves room for the header (top) and prompt bar (bottom) so every
// node fits visibly between them at the default zoom. Users can still
// pan/zoom freely — this only sets the *initial* spread.
//
// V_REACH / H_REACH are the empirical worst-case node distances from
// (cx, cy) as a fraction of baseWinSize, given the radial layout in
// initNodes (cat at 0.36*1.35 horiz / 0.36*0.8 vert, plus a person
// pushed out by another ~0.292 horiz / 0.173 vert at min strength).
function computeLayout(width, height, leftInset = 0) {
  const TOP_INSET = 76;     // header (~64px) + a few px of breathing room
  const BOTTOM_INSET = 116; // prompt input + hint + bottom offset
  const SIDE_INSET = 24;
  const NODE_PAD = 24;      // small bloom/label margin
  // Reach is sized for a *typical* low-strength person (~25), not the
  // theoretical strength=0 worst case. Real scores cluster 20–90 so this
  // fills the safe area without wasting space; the rare very-weak node
  // can drift slightly into the pad area without overlapping UI chrome.
  //   typical pDist factor at strength 25: 0.567
  //   H: 0.486 + 0.567*0.36*1.35 ≈ 0.76
  //   V: 0.288 + 0.567*0.36*0.80 ≈ 0.45
  const H_REACH = 0.76;
  const V_REACH = 0.45;
  const safeH = Math.max(280, height - TOP_INSET - BOTTOM_INSET - NODE_PAD * 2);
  const safeW = Math.max(280, width - leftInset - SIDE_INSET * 2 - NODE_PAD * 2);
  // Bias center to the right of any always-visible left chrome (e.g. the
  // Explorer panel). leftInset = 0 keeps the legacy centered behavior.
  const cx = leftInset + (width - leftInset) / 2;
  const cy = TOP_INSET + NODE_PAD + safeH / 2 - Math.min(safeW, safeH) * 0.05;
  // Reach extends *both* directions from (cx, cy), so each axis only has
  // safe/2 to work with. Clamp to the original min(w,h) so we never
  // accidentally make the graph *larger* than it used to be.
  const baseWinSize = Math.min(
    safeW / 2 / H_REACH,
    safeH / 2 / V_REACH,
    Math.min(width, height),
  );
  return { cx, cy, baseWinSize };
}

function hexWithAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Render a node as a luminous star: layered bloom, bright core, white-hot center.
// Hit area still uses node.radius; the visible core is intentionally smaller so the
// canvas reads as a star chart and labels can live outside the node.
// Bloom radius scales with relationship strength — stronger people glow visibly wider.
function drawStarNode(ctx, node, r, color, alpha, isHovered, strength = 50) {
  const coreR = Math.max(3, r * 0.38);
  const s = Math.max(0, Math.min(100, strength));
  const bloomR = r * (1.5 + (s / 100) * 0.9);

  const bloom = ctx.createRadialGradient(node.x, node.y, coreR * 0.3, node.x, node.y, bloomR);
  bloom.addColorStop(0, hexWithAlpha(color, 0.40 * alpha));
  bloom.addColorStop(0.45, hexWithAlpha(color, 0.12 * alpha));
  bloom.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(node.x, node.y, bloomR, 0, Math.PI * 2);
  ctx.fill();

  const mid = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, coreR * 2.2);
  mid.addColorStop(0, hexWithAlpha(color, 0.75 * alpha));
  mid.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.arc(node.x, node.y, coreR * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(node.x, node.y, coreR, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, 1 * alpha);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(node.x, node.y, coreR * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.62 * alpha})`;
  ctx.fill();

  if (isHovered) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, coreR + 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawNudgeIcon(ctx, pos, type, color, alpha) {
  const size = 10;
  const gx = pos.x + 14;
  const gy = pos.y - 14;

  ctx.save();
  if (type === 'star') {
    const s = size * 0.8;
    ctx.beginPath();
    ctx.moveTo(gx, gy - s * 1.5);
    ctx.quadraticCurveTo(gx, gy, gx + s * 1.5, gy);
    ctx.quadraticCurveTo(gx, gy, gx, gy + s * 1.5);
    ctx.quadraticCurveTo(gx, gy, gx - s * 1.5, gy);
    ctx.quadraticCurveTo(gx, gy, gx, gy - s * 1.5);
    ctx.closePath();
    ctx.fillStyle = hexWithAlpha('#f3d24d', alpha);
    ctx.shadowColor = '#f3d24d';
    ctx.shadowBlur = 10;
    ctx.fill();
    
    // Add a tiny bright center
    ctx.beginPath();
    ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fill();
  } else if (type === 'exclamation') {
    ctx.beginPath();
    ctx.arc(gx, gy, size * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = '#0a0a1e';
    ctx.font = `bold ${size}px Inter`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', gx, gy + 0.5);
  }
  ctx.restore();
}

// Category nodes use a shadcn-style hollow ring + wider/softer bloom so they read
// as "regions" rather than additional stars; the ring + locator dot signal anchor.
function drawCategoryStar(ctx, node, r, color, alpha, isHovered) {
  const coreR = Math.max(5, r * 0.42);
  const bloomR = r * 2.4;

  const bloom = ctx.createRadialGradient(node.x, node.y, coreR * 0.4, node.x, node.y, bloomR);
  bloom.addColorStop(0, hexWithAlpha(color, 0.28 * alpha));
  bloom.addColorStop(0.45, hexWithAlpha(color, 0.10 * alpha));
  bloom.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(node.x, node.y, bloomR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(node.x, node.y, coreR, 0, Math.PI * 2);
  ctx.strokeStyle = hexWithAlpha(color, 0.95 * alpha);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(node.x, node.y, Math.max(1.5, coreR * 0.18), 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(color, 0.85 * alpha);
  ctx.fill();

  if (isHovered) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, coreR + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Walk a multi-segment pulse path (e.g. [YOU, cat, person]) and return (x,y)
// at parameter t in [0,1] proportional to total path length.
function pulsePathPosition(path, t, lookupNode, youX, youY) {
  const points = path.map(id => {
    if (id === 'you') return { x: youX, y: youY };
    const n = lookupNode(id);
    return n ? { x: n.x, y: n.y } : null;
  });
  if (points.some(p => !p)) return null;

  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({ from: points[i], to: points[i + 1], len });
    total += len;
  }
  if (total < 0.01) return points[0];

  let dist = Math.max(0, Math.min(t, 1)) * total;
  for (const s of segs) {
    if (dist <= s.len) {
      const r = dist / s.len;
      return { x: s.from.x + (s.to.x - s.from.x) * r, y: s.from.y + (s.to.y - s.from.y) * r };
    }
    dist -= s.len;
  }
  return segs[segs.length - 1].to;
}

// Spotlight: returns set of ids ('you' + node ids) that should stay bright when
// something is hovered. Null means nothing is hovered = everyone bright.
function computeNeighborSet(hovered, nodes) {
  if (!hovered) return null;
  const set = new Set();
  set.add('you');
  if (hovered.isCenter) {
    for (const n of nodes) if (n.isCategory) set.add(n.id);
    return set;
  }
  set.add(hovered.id);
  if (hovered.isCategory) {
    for (const n of nodes) if (!n.isCategory && n.category === hovered.category) set.add(n.id);
  } else if (hovered.parentCat) {
    set.add(hovered.parentCat.id);
  }
  return set;
}

export const DEMO_PEOPLE = [
  {
    id: '1', name: 'Mom', initials: 'MO', birthday: '1972-03-18',
    lastContactAt: '2026-04-23T18:30:00Z',
    relationship: { type: 'family', strength: 92 },
    context: {
      how_we_met: null, school: 'Stanford University', work: 'Retired elementary school teacher',
      hobbies: ['gardening', 'cooking', 'reading', 'watercolor painting', 'bird watching'],
      sports: ['yoga', 'walking'],
      favorites: {
        foods: ['homemade pasta', 'chocolate cake', 'lemon chicken', 'fresh garden salad'],
        music: ['classical', 'oldies', 'Frank Sinatra', 'Etta James']
      },
    },
    history: {
      memories_together: [
        'Family road trip to Grand Canyon 2019',
        'Teaching me to cook her famous pasta recipe on Sunday afternoons',
        'Movie nights every Sunday with homemade popcorn',
        'Her surprise visit to campus with care packages during finals week',
        'Annual tradition of baking Christmas cookies together',
      ],
      important_events: [
        "Parents' 30th anniversary celebration in June",
        'Her retirement party last year',
        'Recently started taking watercolor classes',
      ],
      things_to_look_forward_to: [
        'Planning a family reunion this summer in Napa',
        'Wants to visit me at UCLA for parents weekend',
        'Her garden tour in May',
      ],
    },
  },
  {
    id: '2', name: 'Jake', initials: 'JK', birthday: '2003-11-02',
    lastContactAt: '2026-04-24T22:00:00Z',
    relationship: { type: 'friend', strength: 78 },
    context: {
      how_we_met: 'Freshman orientation at UCLA, bonded over mutual love of tech and sneakers',
      school: 'UCLA',
      work: 'Part-time at the campus tech support center',
      hobbies: ['gaming', 'skateboarding', 'sneaker collecting', 'building custom PCs', 'photography'],
      sports: ['basketball', 'pickup soccer'],
      favorites: {
        foods: ['ramen', 'burritos', 'korean BBQ', 'boba tea'],
        music: ['hip-hop', 'electronic', 'lo-fi beats', 'Tyler the Creator']
      },
    },
    history: {
      memories_together: [
        'Late-night study sessions for CS 31, survived on energy drinks',
        'Beach day at Santa Monica, taught me to skateboard',
        'Road trip to San Diego Comic-Con',
        'All-nighter building our hackathon project',
        'Weekly basketball games at Wooden Center',
      ],
      important_events: [
        'His birthday party in November',
        'Just got accepted to Google Summer of Code',
        'Recently broke up with his girlfriend',
      ],
      things_to_look_forward_to: [
        'LA Hacks 2026 together',
        'Summer internship at Meta starting June',
        'Planning a camping trip to Big Sur',
      ],
    },
  },
  {
    id: '3', name: 'Sarah', initials: 'SA', birthday: '2003-04-25',
    lastContactAt: '2026-01-10T14:00:00Z',
    relationship: { type: 'friend', strength: 65 },
    context: {
      how_we_met: 'Met through Jake at a house party in Westwood, talked for hours about movies',
      school: 'UCLA',
      work: 'Freelance photographer for campus events',
      hobbies: ['photography', 'film development', 'vintage record collecting', 'thrifting', 'journaling'],
      sports: ['pilates', 'hiking'],
      favorites: {
        foods: ['pho', 'açai bowls', 'dark chocolate', 'cold brew'],
        music: ['indie folk', 'alternative', 'Phoebe Bridgers', 'The National'],
      },
    },
    history: {
      memories_together: [
        'Late-night philosophical conversations at Jake\'s apartment',
        'She photographed my birthday party last year',
        'Thrift shopping adventure in Silver Lake',
        'Showed me her darkroom and film development process',
      ],
      important_events: [
        'Her photography exhibition at the Broad last month',
        'Birthday coming up on April 25th',
        'Recently started dating someone new',
      ],
      things_to_look_forward_to: [
        'Wants to collaborate on a photo project together',
        'Planning to visit Japan this summer',
      ],
    },
  },
  {
    id: '4', name: 'Prof. Chen', initials: 'PC', birthday: '1978-09-15',
    lastContactAt: '2026-04-08T16:00:00Z',
    relationship: { type: 'mentor', strength: 55 },
    context: {
      how_we_met: 'Took his CS M146 Machine Learning class, stayed after lecture with questions',
      school: 'UCLA',
      work: 'CS faculty specializing in machine learning and computer vision',
      hobbies: ['chess', 'reading research papers', 'playing piano', 'running marathons'],
      sports: ['running', 'marathon training'],
      favorites: {
        foods: ['taiwanese food', 'matcha', 'dumplings'],
        music: ['classical piano', 'jazz'],
      },
    },
    history: {
      memories_together: [
        'Office hours discussions about neural networks',
        'He wrote my recommendation letter for internships',
        'Invited me to collaborate on his research project',
        'Coffee chat about career paths in AI',
      ],
      important_events: [
        'Recently published a paper at NeurIPS',
        'Leading the new AI safety initiative at UCLA',
      ],
      things_to_look_forward_to: [
        'Possible summer research position in his lab',
        'He mentioned I should apply for the PhD program',
      ],
    },
  },
  {
    id: '5', name: 'Marcus', initials: 'MA', birthday: '2003-07-22',
    lastContactAt: '2025-12-05T20:00:00Z',
    relationship: { type: 'friend', strength: 40 },
    context: {
      how_we_met: 'Met at the UCLA climbing wall during orientation week',
      school: 'UCLA',
      work: 'Summer camp counselor',
      hobbies: ['rock climbing', 'bouldering', 'slacklining', 'mountain biking', 'camping'],
      sports: ['climbing', 'mountain biking', 'trail running'],
      favorites: {
        foods: ['trail mix', 'protein bars', 'thai food', 'smoothies'],
        music: ['alternative rock', 'indie', 'podcast listener'],
      },
    },
    history: {
      memories_together: [
        'Climbing sessions at Touchstone Gym',
        'Road trip to Joshua Tree for outdoor bouldering',
        'He taught me basic climbing techniques',
      ],
      important_events: [
        'Training for a climbing competition',
        'Planning a Yosemite trip',
      ],
      things_to_look_forward_to: [
        'Should reconnect and hit the climbing wall again',
      ],
    },
  },
  {
    id: '6', name: 'Alex', initials: 'AX', birthday: '2003-05-30',
    lastContactAt: '2026-04-22T11:00:00Z',
    relationship: { type: 'classmate', strength: 70 },
    context: {
      how_we_met: 'Lab partners in CS 111 Operating Systems',
      school: 'UCLA',
      work: 'TA for intro CS courses',
      hobbies: ['chess', 'competitive programming', 'teaching', 'reading sci-fi', 'puzzle solving'],
      sports: ['tennis', 'swimming'],
      favorites: {
        foods: ['indian food', 'bubble tea', 'pizza', 'energy drinks during late coding'],
        music: ['soundtrack music', 'video game OSTs', 'lo-fi'],
      },
    },
    history: {
      memories_together: [
        'All-nighter finishing the OS project together',
        'Chess matches in the student union between classes',
        'Competed together in ACM programming competitions',
        'Study group sessions for algorithms class',
      ],
      important_events: [
        'Just became TA for CS 31',
        'Placed in top 10 at recent coding competition',
        'Considering grad school applications',
      ],
      things_to_look_forward_to: [
        'Planning to do research together next quarter',
        'Weekend chess tournament coming up',
      ],
    },
  },
  {
    id: '7', name: 'Dad', initials: 'DA', birthday: '1970-07-09',
    lastContactAt: '2026-04-12T19:00:00Z',
    relationship: { type: 'family', strength: 85 },
    context: {
      how_we_met: null,
      school: 'UC Berkeley',
      work: 'Civil engineer at a transportation design firm',
      hobbies: ['woodworking', 'hiking', 'grilling', 'fixing things', 'classic car restoration'],
      sports: ['hiking', 'golf', 'used to play softball'],
      favorites: {
        foods: ['steak', 'bbq ribs', 'his own grilled burgers', 'craft beer'],
        music: ['classic rock', 'Eagles', 'Fleetwood Mac', 'Bruce Springsteen'],
      },
    },
    history: {
      memories_together: [
        'Camping trip in Yosemite when I was 12',
        'Building a treehouse together in the backyard',
        'Teaching me to drive in the empty mall parking lot',
        'Working on his old Mustang together on weekends',
        'Annual father-son fishing trips',
      ],
      important_events: [
        "Parents' 30th anniversary coming up",
        'Recently promoted to senior engineer',
        'Finished restoring his 1967 Mustang',
      ],
      things_to_look_forward_to: [
        'Wants to take me on a road trip in the restored Mustang',
        'Planning a hiking trip to Sequoia',
      ],
    },
  },
  {
    id: '8', name: 'Kevin', initials: 'KV', birthday: '1992-03-14',
    lastContactAt: '2025-11-20T15:00:00Z',
    relationship: { type: 'professional', strength: 35 },
    context: {
      how_we_met: 'Reached out to me on LinkedIn about internship opportunities',
      school: 'Carnegie Mellon',
      work: 'Technical recruiter at Anthropic',
      hobbies: ['networking events', 'reading tech news', 'running', 'coffee enthusiast'],
      sports: ['half marathons', 'cycling'],
      favorites: {
        foods: ['salads', 'protein shakes', 'specialty coffee'],
        music: ['podcasts', 'EDM for workouts'],
      },
    },
    history: {
      memories_together: [
        'Initial coffee chat about Anthropic\'s culture',
        'He gave me interview prep advice',
        'Forwarded my resume to the engineering team',
      ],
      important_events: [
        'Helped me prepare for technical interviews',
        'Mentioned potential return offer discussions',
      ],
      things_to_look_forward_to: [
        'Should follow up about summer 2027 opportunities',
      ],
    },
  },
  {
    id: '9', name: 'Lily', initials: 'LI', birthday: '2004-08-21',
    lastContactAt: '2026-04-25T09:00:00Z',
    relationship: { type: 'romantic', strength: 88 },
    context: {
      how_we_met: 'Met at a coffee shop near campus, she was reading my favorite book',
      school: 'UCLA',
      work: 'Part-time at the campus bookstore, considering grad school in art history',
      hobbies: ['painting', 'yoga', 'film photography', 'ceramics', 'reading', 'vintage fashion'],
      sports: ['yoga', 'pilates', 'beach volleyball'],
      favorites: {
        foods: ['sushi', 'matcha lattes', 'farmers market strawberries', 'homemade pasta'],
        music: ['indie rock', 'R&B', 'Mitski', 'Frank Ocean', 'Mac DeMarco'],
      },
    },
    history: {
      memories_together: [
        'First date at Griffith Observatory, talked until the stars came out',
        'Painting together at her apartment every Sunday afternoon',
        'Surprise birthday picnic at the Botanical Gardens',
        'Late night drives to the beach',
        'She taught me to develop film in her darkroom',
        'Weekend trips to thrift stores and art galleries',
      ],
      important_events: [
        'One year anniversary coming up in September',
        'Just got accepted to her top choice grad program',
        'Her senior art exhibition is next month',
      ],
      things_to_look_forward_to: [
        'Trip to San Francisco next month for gallery hopping',
        'Meeting her parents over summer break',
        'Moving in together next year',
      ],
    },
  },
  {
    id: '10', name: 'Ryan', initials: 'RY', birthday: '2003-12-10',
    lastContactAt: '2026-03-30T10:00:00Z',
    relationship: { type: 'classmate', strength: 50 },
    context: {
      how_we_met: 'Group project partner in data structures class',
      school: 'UCLA',
      work: 'Internship at a startup in Santa Monica',
      hobbies: ['entrepreneurship', 'reading business books', 'podcasts', 'surfing', 'networking'],
      sports: ['surfing', 'ultimate frisbee'],
      favorites: {
        foods: ['acai bowls', 'cold brew', 'poke bowls', 'anything from Erewhon'],
        music: ['business podcasts', 'rap', 'house music'],
      },
    },
    history: {
      memories_together: [
        'Late nights working on the group project together',
        'He pitched his startup idea to me multiple times',
        'Grabbed coffee to discuss potential collaboration',
      ],
      important_events: [
        'Recently launched his side project',
        'Raising pre-seed funding',
        'Trying to recruit a technical co-founder',
      ],
      things_to_look_forward_to: [
        'He wants me to advise on the technical architecture',
        'Invited me to demo day',
      ],
    },
  },
  {
    id: '11', name: 'Grandma', initials: 'GM', birthday: '1948-02-14',
    lastContactAt: '2026-04-05T13:00:00Z',
    relationship: { type: 'family', strength: 72 },
    context: {
      how_we_met: null,
      school: null,
      work: 'Retired nurse, volunteered at local hospital for 20 years',
      hobbies: ['knitting', 'gardening', 'baking', 'crossword puzzles', 'church choir'],
      sports: ['walking group', 'gentle yoga'],
      favorites: {
        foods: ['her famous apple pie', 'tea and biscuits', 'Sunday roast'],
        music: ['gospel', 'Nat King Cole', 'hymns'],
      },
    },
    history: {
      memories_together: [
        'Sunday dinners at her place every month, she makes the best pot roast',
        'Learning to knit scarves together',
        'Her stories about growing up during the 60s',
        'She taught me to bake her signature apple pie',
        'Reading her old letters from grandpa',
      ],
      important_events: [
        'Her birthday was on Valentine\'s Day',
        'Recently moved to assisted living',
        'Celebrated 50 years since grandpa passed',
      ],
      things_to_look_forward_to: [
        'Planning to visit her more often',
        'She wants to teach me her pot roast recipe',
      ],
    },
  },
  {
    id: '12', name: 'Tina', initials: 'TI', birthday: '2002-11-18',
    lastContactAt: '2026-03-20T17:00:00Z',
    relationship: { type: 'coworker', strength: 45 },
    context: {
      how_we_met: 'Started working together at the campus dining hall last year',
      school: 'UCLA',
      work: 'Works same shifts at the campus dining hall, studying public health',
      hobbies: ['cooking', 'trying new restaurants', 'dancing', 'true crime podcasts', 'plants'],
      sports: ['zumba', 'dance classes'],
      favorites: {
        foods: ['mexican food', 'anything spicy', 'her homemade tamales', 'boba'],
        music: ['latin pop', 'reggaeton', 'Bad Bunny', 'Rosalía'],
      },
    },
    history: {
      memories_together: [
        'Surviving the lunch rush together',
        'She brought me homemade tamales when I was sick',
        'Funny mishaps in the kitchen',
        'Late-night shift talks about our dreams',
      ],
      important_events: [
        'Applying to grad school for public health',
        'Recently became shift supervisor',
        'Organizing a fundraiser for her community',
      ],
      things_to_look_forward_to: [
        'She invited me to her family\'s restaurant',
        'Wants to teach me to make tamales',
      ],
    },
  },
];

function countInfoFields(p) {
  let n = 0;
  if (p.birthday) n++;
  const c = p.context || {};
  if (c.how_we_met) n++;
  if (c.school) n++;
  if (c.work) n++;
  if (c.hobbies?.length) n++;
  if (c.sports?.length) n++;
  if (c.favorites?.foods?.length) n++;
  if (c.favorites?.music?.length) n++;
  const h = p.history || {};
  if (h.memories_together?.length) n++;
  if (h.important_events?.length) n++;
  if (h.things_to_look_forward_to?.length) n++;
  return Math.max(1, n);
}

const PADDING_TOP = 80;
const PADDING_BOTTOM = 160;
const PADDING_LEFT = 180;
const PADDING_RIGHT = 60;

function clampToBounds(node, width, height) {
  const r = node.radius + 20;
  node.baseX = Math.max(PADDING_LEFT + r, Math.min(width - PADDING_RIGHT - r, node.baseX));
  node.baseY = Math.max(PADDING_TOP + r, Math.min(height - PADDING_BOTTOM - r, node.baseY));
}

export default function ConstellationGraph({ activeFilters, focusedCategory, onZoomOut, onZoomIn, people = DEMO_PEOPLE, categories: dynamicCategories, leftInset = 0, onNodeClick, onNodeDoubleClick, activeTool, onSnip, deletingIds = [], panRef: externalPanRef, isFirstExperience = false, userName = '', onCenterClick, onHoverChange }) {
  const leftInsetRef = useRef(leftInset);
  useEffect(() => {
    leftInsetRef.current = leftInset;
    // Trigger a relayout when the inset changes so target positions update.
    const c = canvasRef.current;
    if (c?.parentElement) {
      const w = c.parentElement.clientWidth;
      const h = c.parentElement.clientHeight;
      // initNodes is defined below — call indirectly via the next-tick path:
      // dispatching a resize event makes the existing resize handler re-run.
      window.dispatchEvent(new Event('resize'));
      void w; void h;
    }
  }, [leftInset]);
  // Merge: built-in CATEGORIES (for stable defaults) + user-created entries
  // by key. Re-evaluated on render so newly-added categories light up
  // immediately on the canvas.
  const CAT_LOOKUP = useMemo(() => {
    const m = { ...CATEGORIES };
    (dynamicCategories || []).forEach((c) => { m[c.key] = { color: c.color }; });
    return m;
  }, [dynamicCategories]);
  // Keep latest onHoverChange in a ref so the canvas effect (which only runs once) can call it.
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => { onHoverChangeRef.current = onHoverChange; }, [onHoverChange]);
  const filterSet = activeFilters instanceof Set ? activeFilters : new Set();
  const hasFilter = filterSet.size > 0;
  const isDimmed = (cat) => {
    if (focusedCategory) return cat !== focusedCategory;
    return hasFilter && !filterSet.has(cat);
  };
  // Fade focus dimming based on zoom: full at scale >= 2.6, gone at <= 1.2
  const dimAmount = (cat, scale) => {
    if (focusedCategory) {
      if (cat === focusedCategory) return 0;
      const t = Math.max(0, Math.min(1, (scale - 1.2) / (2.6 - 1.2)));
      return t;
    }
    return hasFilter && !filterSet.has(cat) ? 1 : 0;
  };
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const animRef = useRef(null);
  const hoveredRef = useRef(null);
  const hoverStartRef = useRef(0);
  const hoveredEdgeRef = useRef(null);
  // Per-node spotlight dim, eased per frame so non-neighbors fade in/out of
  // the dim state instead of snapping. 0 = fully bright, 1 = fully dimmed.
  const hoverDimsRef = useRef(new Map());
  const clickTimerRef = useRef(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
const internalPanRef = useRef({ x: 0, y: 0 });
  const userPanRef = externalPanRef ?? internalPanRef;
  const youPosRef = useRef({ x: 0, y: 0 });
  const camRef = useRef({ x: 0, y: 0, scale: 1, targetX: 0, targetY: 0, targetScale: 1 });
  const zoomRef = useRef(1);
  const focusedCategoryRef = useRef(focusedCategory);
  useEffect(() => { focusedCategoryRef.current = focusedCategory; }, [focusedCategory]);
  const dragStateRef = useRef({ active: false, nodeId: null, startMx: 0, startMy: 0, startNx: 0, startNy: 0, moved: false, suppressClick: false, lastMx: 0, lastMy: 0, vx: 0, vy: 0 });
  const panMomentumRef = useRef({ vx: 0, vy: 0, raf: null });
  const particlesRef = useRef([]); // [{x,y,vx,vy,r,alpha,color,life,maxLife}]
  const prevDeletingRef = useRef([]); // track when ids newly enter deleting
  const lastActivityRef = useRef(performance.now());
  const recenteredRef = useRef(false);
  const wheelLockUntilRef = useRef(0);
  const pulsesRef = useRef([]); // [{path,t,speed,color}] light packets along YOU→cat→person
  const leanRef = useRef({ x: 0, y: 0 }); // smoothed magnetic lean of hovered node toward cursor
  const prevHoveredIdRef = useRef(null); // hover transitions trigger one chain pulse

  const catLabelByKey = useMemo(() => {
    const m = {};
    (dynamicCategories || []).forEach((c) => { m[c.key] = c.label; });
    return m;
  }, [dynamicCategories]);
  const catLabelByKeyRef = useRef(catLabelByKey);
  useEffect(() => {
    catLabelByKeyRef.current = catLabelByKey;
    // Relayout so freshly-renamed/created categories show their friendly
    // label on the canvas instead of stale text.
    window.dispatchEvent(new Event('resize'));
  }, [catLabelByKey]);

  const initNodes = useCallback((width, height) => {
    const { cx, cy, baseWinSize } = computeLayout(width, height, leftInsetRef.current);

    const grouped = {};
    for (const p of people) {
      const cat = p.relationship?.type ?? 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }

    const catKeys = Object.keys(grouped);
    const numCats = catKeys.length;
    const nodes = [];

    catKeys.forEach((catKey, i) => {
      const g = grouped[catKey];
      const sum = g.reduce((acc, p) => acc + (p.relationship?.strength ?? 50), 0);
      const avgStrength = sum / Math.max(1, g.length);

      // Categories all orbit YOU at the same distance — only individual people
      // get pulled in or pushed out by their personal relationship strength.
      const catRadiusOffset = baseWinSize * 0.36;
      const theta = (i * (Math.PI * 2)) / Math.max(1, numCats) - Math.PI / 2;

      const baseCatX = cx + Math.cos(theta) * catRadiusOffset * 1.35;
      const baseCatY = cy + Math.sin(theta) * catRadiusOffset * 0.8;

      const oldCat = nodesRef.current.find(old => old.id === `cat_${catKey}`);
      const manualOffX = oldCat ? (oldCat.manualOffX ?? 0) : 0;
      const manualOffY = oldCat ? (oldCat.manualOffY ?? 0) : 0;

      const friendlyLabel = catLabelByKeyRef.current[catKey];
      const displayName = (friendlyLabel || catKey).toUpperCase();
      const catNode = {
        isCategory: true,
        id: `cat_${catKey}`,
        name: displayName,
        initials: '',
        category: catKey,
        avgStrength,
        x: oldCat ? oldCat.x : baseCatX + manualOffX,
        y: oldCat ? oldCat.y : baseCatY + manualOffY,
        targetX: baseCatX + manualOffX,
        targetY: baseCatY + manualOffY,
        baseX: baseCatX,
        baseY: baseCatY,
        manualOffX,
        manualOffY,
        theta,
        catRadiusOffset,
        radius: 32,
      };
      nodes.push(catNode);

      const peopleList = grouped[catKey];
      const numPeople = peopleList.length;
      const spreadAngle = Math.PI * 0.5;
      let startAngle = theta - spreadAngle / 2;
      if (numPeople === 1) startAngle = theta;
      const angleStep = numPeople > 1 ? spreadAngle / (numPeople - 1) : 0;

      peopleList.forEach((person, j) => {
        const infoFields = countInfoFields(person);
        const personR = 14 + (Math.min(infoFields, 8) / 8) * 12;
        const pTheta = startAngle + j * angleStep;
        // Proximity = strength: strong relationships sit close to the category
        // anchor, weak ones drift outward into a looser ring of acquaintances.
        const pStrength = Math.max(0, Math.min(100, person.relationship?.strength ?? 50));
        // Strength → proximity. Wider dynamic range + concave curve so a
        // mid-strength person (35) and a strong one (88) sit at visibly
        // different orbits, not just nudged. Strong people hug the
        // category anchor; weak people drift far past it.
        //   pDist factor: strength 0 → 0.85, 35 → 0.54, 50 → 0.45,
        //                 88 → 0.21, 100 → 0.10  (≈ 8× dynamic range)
        const sNorm = pStrength / 100;
        const pDist = catRadiusOffset * (0.85 - Math.pow(sNorm, 0.7) * 0.75);
        const basePx = baseCatX + Math.cos(pTheta) * pDist * 1.35;
        const basePy = baseCatY + Math.sin(pTheta) * pDist * 0.8;

        const oldNode = nodesRef.current.find(old => old.id === person.id);
        const pManualOffX = oldNode ? (oldNode.manualOffX ?? 0) : 0;
        const pManualOffY = oldNode ? (oldNode.manualOffY ?? 0) : 0;

        nodes.push({
          ...person,
          isCategory: false,
          category: catKey,
          strength: person.relationship?.strength ?? 0,
          scoringStatus: person.scoring?.status ?? null,
          // True once the AI pipeline has produced real dimension scores.
          // Until then, edges render neutral so unscored nodes don't fake a strength.
          isScored: Boolean(person.scoring?.dimensions),
          parentCat: catNode,
          x: oldNode ? oldNode.x : basePx + pManualOffX,
          y: oldNode ? oldNode.y : basePy + pManualOffY,
          targetX: basePx + pManualOffX,
          targetY: basePy + pManualOffY,
          baseX: basePx,
          baseY: basePy,
          manualOffX: pManualOffX,
          manualOffY: pManualOffY,
          radius: personR,
          orbitAngle: oldNode ? oldNode.orbitAngle : Math.random() * Math.PI * 2,
          orbitRadius: oldNode ? oldNode.orbitRadius : 2 + Math.random() * 3,
          orbitSpeed: oldNode ? oldNode.orbitSpeed : 0.0006 + Math.random() * 0.0008,
          daysSince: daysSince(person.lastContactAt),
          isBirthday: isBirthdayToday(person.birthday),
          // If the person has an explicit status (like 'yellow'), use it. 
          // Otherwise, if they are stale (>30 days), default to 'red'.
          nudgeStatus: person.nudgeStatus || (daysSince(person.lastContactAt) > 30 ? 'red' : null),
        });
      });
    });

    nodesRef.current = nodes;
  }, [people]);

  // Reset user pan only when entering a category focus, so scroll-out exits
  // smoothly without snapping the camera.
  useEffect(() => {
    if (focusedCategory) {
      userPanRef.current.x = 0;
      userPanRef.current.y = 0;
      zoomRef.current = 2.6;
    }
  }, [focusedCategory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.parentElement.clientWidth;
    let height = canvas.parentElement.clientHeight;

    const resize = () => {
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      initNodes(width, height);
    };
    resize();

    const getCenter = () => {
      const { cx, cy } = computeLayout(width, height, leftInsetRef.current);
      return { cx, cy };
    };

    const screenToWorld = (sx, sy) => {
      const { cx, cy } = getCenter();
      return {
        wx: (sx - (camRef.current.x + cx)) / camRef.current.scale + cx,
        wy: (sy - (camRef.current.y + cy)) / camRef.current.scale + cy,
      };
    };

    const hitTest = (mx, my) => {
      const { cx, cy } = getCenter();
      const { wx, wy } = screenToWorld(mx, my);
      // YOU lives in world space at (cx + youOffset)
      const youX = cx + youPosRef.current.x;
      const youY = cy + youPosRef.current.y;
      const ydist = Math.sqrt((wx - youX) ** 2 + (wy - youY) ** 2);
      if (ydist < 44 && !focusedCategoryRef.current) return { id: 'center', isCenter: true };
      for (const node of [...nodesRef.current].reverse()) {
        if (Math.sqrt((wx - node.x) ** 2 + (wy - node.y) ** 2) < node.radius + 6) return node;
      }
      return null;
    };

    const hitTestEdge = (mx, my) => {
      const { wx, wy } = screenToWorld(mx, my);
      const { cx, cy } = getCenter();
      let best = null; let bestDist = 14;
      for (const node of nodesRef.current) {
        let ax, ay, bx, by;
        if (node.isCategory) { ax = cx; ay = cy; bx = node.x; by = node.y; }
        else { const p = node.parentCat; if (!p) continue; ax = p.x; ay = p.y; bx = node.x; by = node.y; }
        const dx = bx - ax; const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((wx - ax) * dx + (wy - ay) * dy) / len2));
        const dist = Math.sqrt((wx - ax - t * dx) ** 2 + (wy - ay - t * dy) ** 2);
        if (dist < bestDist) { bestDist = dist; best = node; }
      }
      return best;
    };

    const dragState = dragStateRef.current;

    const stopMomentum = () => {
      if (panMomentumRef.current.raf) {
        cancelAnimationFrame(panMomentumRef.current.raf);
        panMomentumRef.current.raf = null;
      }
      panMomentumRef.current.vx = 0;
      panMomentumRef.current.vy = 0;
    };

    const applyPanToCamera = () => {
      const fc = focusedCategoryRef.current;
      if (fc) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === fc);
        if (catNode) {
          const s = camRef.current.scale;
          const { cx: lcx, cy: lcy } = computeLayout(width, height, leftInsetRef.current);
          camRef.current.x = (lcx - catNode.x) * s + userPanRef.current.x;
          camRef.current.y = (lcy - catNode.y) * s + userPanRef.current.y;
        }
      } else {
        camRef.current.x = userPanRef.current.x;
        camRef.current.y = userPanRef.current.y;
      }
    };

    const stepMomentum = () => {
      const m = panMomentumRef.current;
      userPanRef.current.x += m.vx;
      userPanRef.current.y += m.vy;
      applyPanToCamera();
      m.vx *= PAN_INERTIA_DECAY;
      m.vy *= PAN_INERTIA_DECAY;
      if (Math.abs(m.vx) < PAN_INERTIA_MIN_VELOCITY && Math.abs(m.vy) < PAN_INERTIA_MIN_VELOCITY) {
        m.raf = null;
        return;
      }
      m.raf = requestAnimationFrame(stepMomentum);
    };

    const markActivity = () => {
      lastActivityRef.current = performance.now();
      recenteredRef.current = false;
    };

    const onMouseDown = (e) => {
      markActivity();
      if (activeTool === 'snip') return;
      stopMomentum();
      const rect = canvas.getBoundingClientRect();
      const node = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      dragState.active = true;
      dragState.startMx = e.clientX;
      dragState.startMy = e.clientY;
      dragState.lastMx = e.clientX;
      dragState.lastMy = e.clientY;
      dragState.vx = 0;
      dragState.vy = 0;
      dragState.moved = false;
      dragState.suppressClick = false;
      if (!node) {
        if (isFirstExperience) { dragState.active = false; return; }
        dragState.nodeId = 'pan';
        dragState.startNx = userPanRef.current.x;
        dragState.startNy = userPanRef.current.y;
      } else if (node.isCenter) {
        if (isFirstExperience) { dragState.active = false; return; }
        dragState.nodeId = 'you';
        dragState.startNx = youPosRef.current.x;
        dragState.startNy = youPosRef.current.y;
      } else {
        dragState.nodeId = node.id;
        dragState.startNx = node.manualOffX ?? 0;
        dragState.startNy = node.manualOffY ?? 0;
      }
    };

    const onMouseUp = () => {
      if (dragState.active && dragState.moved) dragState.suppressClick = true;
      if (dragState.active && dragState.nodeId === 'pan' && (Math.abs(dragState.vx) > 0.5 || Math.abs(dragState.vy) > 0.5)) {
        panMomentumRef.current.vx = dragState.vx;
        panMomentumRef.current.vy = dragState.vy;
        if (!panMomentumRef.current.raf) panMomentumRef.current.raf = requestAnimationFrame(stepMomentum);
      }
      dragState.active = false;
      dragState.nodeId = null;
    };

    const onMouseMove = (e) => {
      markActivity();
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (dragState.active && dragState.nodeId) {
        const dxPx = e.clientX - dragState.startMx;
        const dyPx = e.clientY - dragState.startMy;
        if (!dragState.moved && (Math.abs(dxPx) > 4 || Math.abs(dyPx) > 4)) dragState.moved = true;
        const dxW = dxPx / camRef.current.scale;
        const dyW = dyPx / camRef.current.scale;

        if (dragState.nodeId === 'pan') {
          dragState.vx = e.clientX - dragState.lastMx;
          dragState.vy = e.clientY - dragState.lastMy;
          dragState.lastMx = e.clientX;
          dragState.lastMy = e.clientY;
          userPanRef.current.x = dragState.startNx + dxPx;
          userPanRef.current.y = dragState.startNy + dyPx;
          // Snap camera to the correct target (focusOffset + userPan when focused, else userPan)
          // so cursor tracks 1:1 with no spring lag.
          if (focusedCategoryRef.current) {
            const catNode = nodesRef.current.find(n => n.isCategory && n.category === focusedCategoryRef.current);
            if (catNode) {
              const s = camRef.current.scale;
              const { cx: lcx, cy: lcy } = computeLayout(width, height, leftInsetRef.current);
              camRef.current.x = (lcx - catNode.x) * s + userPanRef.current.x;
              camRef.current.y = (lcy - catNode.y) * s + userPanRef.current.y;
            }
          } else {
            camRef.current.x = userPanRef.current.x;
            camRef.current.y = userPanRef.current.y;
          }
        } else if (dragState.nodeId === 'you') {
          youPosRef.current.x = dragState.startNx + dxW;
          youPosRef.current.y = dragState.startNy + dyW;
        } else {
          const node = nodesRef.current.find(n => n.id === dragState.nodeId);
          if (node) {
            const newOffX = dragState.startNx + dxW;
            const newOffY = dragState.startNy + dyW;
            if (node.isCategory) {
              const diffX = newOffX - (node.manualOffX ?? 0);
              const diffY = newOffY - (node.manualOffY ?? 0);
              node.manualOffX = newOffX; node.manualOffY = newOffY;
              node.targetX = node.baseX + newOffX; node.targetY = node.baseY + newOffY;
              for (const pn of nodesRef.current) {
                if (!pn.isCategory && pn.category === node.category) {
                  pn.manualOffX = (pn.manualOffX ?? 0) + diffX;
                  pn.manualOffY = (pn.manualOffY ?? 0) + diffY;
                  pn.targetX = pn.baseX + pn.manualOffX;
                  pn.targetY = pn.baseY + pn.manualOffY;
                }
              }
            } else {
              node.manualOffX = newOffX; node.manualOffY = newOffY;
              node.targetX = node.baseX + newOffX; node.targetY = node.baseY + newOffY;
            }
          }
        }
        canvas.style.cursor = 'grabbing';
        return;
      }

      if (activeTool === 'snip') {
        hoveredEdgeRef.current = hitTestEdge(mouseRef.current.x, mouseRef.current.y);
        if (hoveredRef.current) {
          hoverStartRef.current = 0;
          onHoverChangeRef.current?.(null);
        }
        hoveredRef.current = null;
        canvas.style.cursor = 'crosshair';
      } else {
        hoveredEdgeRef.current = null;
        const found = hitTest(mouseRef.current.x, mouseRef.current.y);
        const prev = hoveredRef.current;
        if (found?.id !== prev?.id) {
          hoverStartRef.current = found && !found.isCategory && !found.isCenter ? performance.now() : 0;
          if (found && found.isCenter) {
            onHoverChangeRef.current?.(null);
          } else if (found?.isCategory) {
            onHoverChangeRef.current?.({ id: found.id, type: 'category', category: found.category });
          } else if (found) {
            onHoverChangeRef.current?.({ id: found.id, type: 'person', category: found.category });
          } else {
            onHoverChangeRef.current?.(null);
          }
        }
        hoveredRef.current = found;
        canvas.style.cursor = found ? 'pointer' : 'grab';
      }
    };

    const onClick = (e) => {
      if (dragState.active) return;
      if (dragState.suppressClick) { dragState.suppressClick = false; return; }
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
      if (activeTool === 'snip') { const edge = hitTestEdge(mx, my); if (edge) onSnip?.(edge); return; }
      const node = hitTest(mx, my);
      if (!node) return;
      if (node.isCenter) { onCenterClick?.(); return; }
      if (e.shiftKey && !node.isCategory) {
        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
        onNodeDoubleClick?.(node);
        return;
      }

      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current); clickTimerRef.current = null;
        onNodeDoubleClick?.(node);
      } else {
        const cx = e.clientX; const cy = e.clientY;
        clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; onNodeClick?.(node, { x: cx, y: cy }); }, 250);
      }
    };

    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
        const h = hoveredRef.current;
        if (h && !h.isCenter) {
          e.preventDefault();
          onSnip?.(h);
          hoveredRef.current = null;
          hoverStartRef.current = 0;
        }
        return;
      }
      if (e.key === 'Escape' || e.key === '-') {
        stopMomentum();
        markActivity();
        wheelLockUntilRef.current = performance.now() + 500;
        userPanRef.current.x = 0;
        userPanRef.current.y = 0;
        youPosRef.current.x = 0;
        youPosRef.current.y = 0;
        zoomRef.current = 1;
        camRef.current.targetX = 0;
        camRef.current.targetY = 0;
        camRef.current.targetScale = 1;
        onZoomOut?.();
      }
    };
    const onWheel = (e) => {
      e.preventDefault();
      if (performance.now() < wheelLockUntilRef.current) return;
      markActivity();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { cx, cy } = getCenter();
      // Use current cam scale (mid-spring) so transitions are continuous.
      const oldScale = camRef.current.scale;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newScale = Math.max(0.4, Math.min(4, oldScale * factor));
      if (newScale === oldScale) return;
      const wx = (mx - cx - camRef.current.x) / oldScale + cx;
      const wy = (my - cy - camRef.current.y) / oldScale + cy;
      const newCamX = mx - cx - (wx - cx) * newScale;
      const newCamY = my - cy - (wy - cy) * newScale;
      zoomRef.current = newScale;
      camRef.current.scale = newScale;
      camRef.current.x = newCamX;
      camRef.current.y = newCamY;
      camRef.current.targetScale = newScale;
      camRef.current.targetX = newCamX;
      camRef.current.targetY = newCamY;
      // Sync userPan so the draw loop's spring target equals current cam.
      // In focused mode: cam = (cx - catNode.x) * scale + userPan.
      const fc = focusedCategoryRef.current;
      const exitingFocus = fc && newScale < 1.2;
      if (fc && !exitingFocus) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === fc);
        if (catNode) {
          userPanRef.current.x = newCamX - (cx - catNode.x) * newScale;
          userPanRef.current.y = newCamY - (cy - catNode.y) * newScale;
        }
      } else {
        userPanRef.current.x = newCamX;
        userPanRef.current.y = newCamY;
      }
      if (exitingFocus) onZoomOut?.();
      stopMomentum();
    };

    const draw = () => {
      timeRef.current += 1;
      const { cx, cy } = getCenter();
      ctx.clearRect(0, 0, width, height);

      // Auto-recenter after 10s of inactivity (skip while dragging or in first-experience).
      if (!recenteredRef.current && !dragStateRef.current.active && !isFirstExperience &&
          performance.now() - lastActivityRef.current > 10000) {
        recenteredRef.current = true;
        stopMomentum();
        userPanRef.current.x = 0;
        userPanRef.current.y = 0;
        youPosRef.current.x = 0;
        youPosRef.current.y = 0;
        zoomRef.current = 1;
        if (focusedCategoryRef.current) onZoomOut?.();
      }

      // Camera target. Treat as unfocused once zoom drops below the exit
      // threshold even if focusedCategory hasn't cleared yet — otherwise the
      // focused-mode formula misuses the just-set absolute pan and jumps.
      if (focusedCategoryRef.current && zoomRef.current >= 1.2) {
        const catNode = nodesRef.current.find(n => n.isCategory && n.category === focusedCategoryRef.current);
        if (catNode) {
          const focusScale = zoomRef.current;
          camRef.current.targetX = (cx - catNode.x) * focusScale + userPanRef.current.x;
          camRef.current.targetY = (cy - catNode.y) * focusScale + userPanRef.current.y;
          camRef.current.targetScale = focusScale;
        }
      } else {
        camRef.current.targetX = userPanRef.current.x;
        camRef.current.targetY = userPanRef.current.y;
        camRef.current.targetScale = zoomRef.current;
      }
      camRef.current.x += (camRef.current.targetX - camRef.current.x) * 0.08;
      camRef.current.y += (camRef.current.targetY - camRef.current.y) * 0.08;
      camRef.current.scale += (camRef.current.targetScale - camRef.current.scale) * 0.08;

      // Collision pass: nudge overlapping nodes apart through their target offsets
      const draggedId = dragStateRef.current.active ? dragStateRef.current.nodeId : null;
      const collidable = nodesRef.current.filter(n => !deletingIds.includes(n.id) && n.id !== draggedId);
      const youR = 44;
      const youWX = cx + youPosRef.current.x;
      const youWY = cy + youPosRef.current.y;
      for (let i = 0; i < collidable.length; i++) {
        const a = collidable[i];
        // YOU obstacle (constellation origin, follows youPos)
        {
          const dx = a.x - youWX, dy = a.y - youWY;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = a.radius + youR + 8;
          if (d < minD) {
            const push = (minD - d) * 0.12;
            const nx = dx / d, ny = dy / d;
            a.manualOffX = (a.manualOffX ?? 0) + nx * push;
            a.manualOffY = (a.manualOffY ?? 0) + ny * push;
            a.targetX = a.baseX + a.manualOffX;
            a.targetY = a.baseY + a.manualOffY;
          }
        }
        for (let j = i + 1; j < collidable.length; j++) {
          const b = collidable[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const minD = a.radius + b.radius + 8;
          if (d < minD) {
            const overlap = (minD - d) * 0.06;
            const nx = dx / d, ny = dy / d;
            a.manualOffX = (a.manualOffX ?? 0) - nx * overlap;
            a.manualOffY = (a.manualOffY ?? 0) - ny * overlap;
            b.manualOffX = (b.manualOffX ?? 0) + nx * overlap;
            b.manualOffY = (b.manualOffY ?? 0) + ny * overlap;
            a.targetX = a.baseX + a.manualOffX;
            a.targetY = a.baseY + a.manualOffY;
            b.targetX = b.baseX + b.manualOffX;
            b.targetY = b.baseY + b.manualOffY;
          }
        }
      }

      // Spring step — node target is its base layout + manual offset + youPos shift
      const yox = youPosRef.current.x, yoy = youPosRef.current.y;
      for (const a of nodesRef.current) {
        let swayX = 0; let swayY = 0;
        if (!a.isCategory) {
          swayX = Math.sin(timeRef.current * a.orbitSpeed * 15 + a.orbitAngle) * 1.5;
          swayY = Math.cos(timeRef.current * a.orbitSpeed * 17 + a.orbitAngle) * 1.5;
        }
        a.x += ((a.targetX + yox + swayX) - a.x) * 0.1;
        a.y += ((a.targetY + yoy + swayY) - a.y) * 0.1;
      }

      // Pulses fire on hover transitions only. Travel speed encodes relationship
      // strength: stronger ties pulse faster, weaker ties drift slowly.
      {
        const hovId = hoveredRef.current?.id || null;
        if (hovId !== prevHoveredIdRef.current) {
          prevHoveredIdRef.current = hovId;
          const target = hoveredRef.current;
          if (target && !target.isCenter && !deletingIds.includes(target.id) && !isDimmed(target.category)) {
            const path = target.isCategory
              ? ['you', target.id]
              : ['you', target.parentCat?.id, target.id].filter(Boolean);
            if (path.length >= 2) {
              const s = Math.max(0, Math.min(100, target.isCategory ? 60 : (target.strength ?? 50)));
              const speed = 1 / (140 - s * 0.9); // s=0 → 1/140, s=100 → 1/50
              pulsesRef.current.push({
                path, t: 0, speed,
                color: CAT_LOOKUP[target.category]?.color || '#cdc9c0',
              });
            }
          }
        }
        pulsesRef.current = pulsesRef.current.filter(p => p.t < 1);
        for (const p of pulsesRef.current) p.t += p.speed;
      }

      // Spawn particles for newly-deleting nodes
      const newIds = deletingIds.filter(id => !prevDeletingRef.current.includes(id));
      if (newIds.length > 0) {
        for (const id of newIds) {
          const node = nodesRef.current.find(n => n.id === id);
          if (!node) continue;
          const cat = CAT_LOOKUP[node.category] || CAT_LOOKUP.other;
          // convert node world pos to screen pos
          const sx = (node.x - cx) * camRef.current.scale + cx + camRef.current.x;
          const sy = (node.y - cy) * camRef.current.scale + cy + camRef.current.y;
          const numP = node.isCategory ? 22 : 14;
          for (let p = 0; p < numP; p++) {
            const angle = (p / numP) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 1.5 + Math.random() * 3.5;
            particlesRef.current.push({
              x: sx, y: sy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 2 + Math.random() * (node.isCategory ? 5 : 3),
              alpha: 1,
              color: cat.color,
              life: 0, maxLife: 45 + Math.random() * 20,
            });
          }
        }
      }
      prevDeletingRef.current = [...deletingIds];

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
      for (const p of particlesRef.current) { p.x += p.vx; p.y += p.vy; p.vx *= 0.93; p.vy *= 0.93; p.life++; p.alpha = 1 - p.life / p.maxLife; }

      ctx.save();
      ctx.translate(cx + camRef.current.x, cy + camRef.current.y);
      ctx.scale(camRef.current.scale, camRef.current.scale);
      ctx.translate(-cx, -cy);

      const youWorldX = cx + youPosRef.current.x;
      const youWorldY = cy + youPosRef.current.y;

      // Spotlight + magnetic lean. neighborSet=null means nothing is hovered = full bright.
      // edgeAlphaMul folds the zoom-fade dim from gogobop into the hover-spotlight dim.
      const neighborSet = computeNeighborSet(hoveredRef.current, nodesRef.current);
      // Ease per-node spotlight dim toward target (1 = dimmed, 0 = bright)
      // so hover-in / hover-out transitions are gradual, not instant.
      const HOVER_EASE = 0.12;
      const hoverDims = hoverDimsRef.current;
      const allIds = ['you', ...nodesRef.current.map((n) => n.id)];
      for (const id of allIds) {
        const target = (neighborSet && !neighborSet.has(id)) ? 1 : 0;
        const prev = hoverDims.get(id) ?? 0;
        hoverDims.set(id, prev + (target - prev) * HOVER_EASE);
      }
      const getHoverDim = (id) => hoverDims.get(id) ?? 0;
      const edgeAlphaMul = (fromId, toId, cat) => {
        let m = 1;
        const dimT = dimAmount(cat, camRef.current.scale);
        if (dimT > 0) m *= (1 - dimT * (1 - 0.12));
        const edgeDim = Math.max(getHoverDim(fromId), getHoverDim(toId));
        if (edgeDim > 0) m *= 1 - edgeDim * (1 - 0.20);
        return m;
      };
      {
        let tlx = 0, tly = 0;
        const hv = hoveredRef.current;
        if (hv && !hv.isCenter && typeof hv.x === 'number') {
          const { wx, wy } = screenToWorld(mouseRef.current.x, mouseRef.current.y);
          const dx = wx - hv.x, dy = wy - hv.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.5) {
            const mag = Math.min(6, len * 0.18);
            tlx = (dx / len) * mag; tly = (dy / len) * mag;
          }
        }
        leanRef.current.x += (tlx - leanRef.current.x) * 0.18;
        leanRef.current.y += (tly - leanRef.current.y) * 0.18;
      }

      // YOU → cat trunk edges (world space) — uniform 2.0px, white
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        if (!node.isCategory) continue;
        const isHovEdge = hoveredEdgeRef.current?.id === node.id;
        const dimMul = edgeAlphaMul('you', node.id, node.category);
        const ea = isHovEdge ? 0.95 : (0.1 + (node.avgStrength / 100) * 0.3) * dimMul;
        const ew = 2.0;
        ctx.beginPath(); ctx.moveTo(youWorldX, youWorldY); ctx.lineTo(node.x, node.y);
        ctx.lineWidth = ew;
        if (isHovEdge && activeTool === 'snip') {
          ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,80,80,0.95)';
          ctx.shadowColor = 'rgba(255,80,80,0.8)'; ctx.shadowBlur = 12;
        } else { ctx.strokeStyle = `rgba(255,255,255,${ea})`; }
        ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
      }

      // Cat→Person edges — uniform 1.0px, color tier still encodes strength
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        if (node.isCategory) continue;
        const isHovEdge = hoveredEdgeRef.current?.id === node.id;
        {
          const p = node.parentCat;
          if (!p || deletingIds.includes(p.id)) continue;
          const isHovPEdge = hoveredEdgeRef.current?.id === node.id;
          const rgb = '160,160,170';
          const ew = 1.0;
          const eMul = edgeAlphaMul(p.id, node.id, node.category);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(node.x, node.y);
          ctx.lineWidth = ew;
          if (isHovPEdge && activeTool === 'snip') {
            ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(255,80,80,0.95)';
            ctx.shadowColor = 'rgba(255,80,80,0.8)'; ctx.shadowBlur = 12;
          } else { ctx.strokeStyle = `rgba(${rgb}, ${(node.isScored ? 0.55 : 0.32) * eMul})`; }
          ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        }
      }

      // Light packets along the chain — drawn after edges, before nodes.
      // 3-dot fading trail makes the direction (from YOU outward) unambiguous.
      const lookupNode = (id) => nodesRef.current.find(n => n.id === id);
      for (const pp of pulsesRef.current) {
        if (pp.t < 0) continue;
        const lastId = pp.path[pp.path.length - 1];
        const termNode = lookupNode(lastId);
        if (!termNode || deletingIds.includes(termNode.id)) continue;
        let dimM = 1;
        if (isDimmed(termNode.category)) dimM *= 0.12;
        const ease = Math.sin(Math.max(0, Math.min(1, pp.t)) * Math.PI);
        for (let i = 3; i >= 0; i--) {
          const tt = pp.t - i * 0.022;
          if (tt < 0) continue;
          const pos = pulsePathPosition(pp.path, tt, lookupNode, youWorldX, youWorldY);
          if (!pos) continue;
          const fade = 1 - i * 0.22;
          const a = ease * fade * 0.95 * dimM;
          if (i === 0) {
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = hexWithAlpha(pp.color, a * 0.22); ctx.fill();
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = hexWithAlpha(pp.color, a); ctx.fill();
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 1.0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${a * 0.85})`; ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(0.6, 1.8 - i * 0.3), 0, Math.PI * 2);
            ctx.fillStyle = hexWithAlpha(pp.color, a * 0.6); ctx.fill();
          }
        }
      }

      // Nodes — luminous stars (people) + hollow rings (categories), labels below.
      for (const node of nodesRef.current) {
        if (deletingIds.includes(node.id)) continue;
        const cat = CAT_LOOKUP[node.category] || CAT_LOOKUP.other;
        const dimT = dimAmount(node.category, camRef.current.scale);
        const isHov = hoveredRef.current?.id === node.id;
        const filterDimVal = 1 - dimT * (1 - 0.20);
        const hoverDimVal = 1 - getHoverDim(node.id) * (1 - 0.28);
        const nodeAlpha = filterDimVal * hoverDimVal;
        const r = node.radius * (isHov ? 1.18 : 1);
        const renderColor = dimT > 0.5 ? '#6a6f7a' : cat.color;

        const lx = isHov ? leanRef.current.x : 0;
        const ly = isHov ? leanRef.current.y : 0;
        const pos = { x: node.x + lx, y: node.y + ly };

        if (node.isCategory) {
          drawCategoryStar(ctx, pos, r, renderColor, nodeAlpha, isHov);
        } else {
          drawStarNode(ctx, pos, r, renderColor, nodeAlpha, isHov, node.strength);
        }

        const labelY = pos.y + r * (node.isCategory ? 0.5 : 0.48) + 14;
        ctx.fillStyle = node.isCategory
          ? hexWithAlpha(renderColor, 0.92 * nodeAlpha)
          : `rgba(232, 232, 240, ${0.95 * nodeAlpha})`;
        if (node.isCategory) {
          ctx.font = `500 11px 'Geist',system-ui,sans-serif`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
        } else {
          ctx.font = `400 12px 'Geist',system-ui,sans-serif`;
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0.02em';
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.name, pos.x, labelY);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

        if (!node.isCategory) {
          if (node.scoringStatus === 'pending') {
            const coreR = Math.max(3, r * 0.38);
            const pulseS = 1 + Math.sin(timeRef.current * 0.08) * 0.04;
            const ringR = (coreR * 1.7 + 6) * pulseS;
            const phase = (timeRef.current * 0.6) % 24;
            ctx.save();
            ctx.beginPath(); ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
            ctx.setLineDash([4, 4]); ctx.lineDashOffset = -phase;
            ctx.strokeStyle = `rgba(232,232,240,${0.55 * nodeAlpha})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          } else if (node.scoringStatus === 'failed') {
            const coreR = Math.max(3, r * 0.38);
            const gx = pos.x + coreR * 1.4, gy = pos.y - coreR * 1.4;
            ctx.save();
            ctx.beginPath(); ctx.arc(gx, gy, coreR * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,140,120,${0.95 * nodeAlpha})`; ctx.fill();
            ctx.fillStyle = `rgba(11,15,25,${0.95 * nodeAlpha})`;
            ctx.font = `600 ${Math.max(8, coreR * 0.7)}px 'Geist',system-ui,sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('!', gx, gy + 0.5);
            ctx.restore();
          }

          // Birthday Star
          if (node.isBirthday) {
            drawNudgeIcon(ctx, pos, 'star', '#f3d24d', nodeAlpha);
          }

          // Stale Nudge
          if (node.nudgeStatus === 'red' || node.nudgeStatus === 'yellow') {
            const nudgeColor = node.nudgeStatus === 'red' ? '#f05050' : '#f3d24d';
            // If birthday or failed status is already there, offset the exclamation mark
            const hasIndicator = node.isBirthday || node.scoringStatus === 'failed';
            const offsetPos = hasIndicator ? { x: pos.x - 28, y: pos.y } : pos;
            drawNudgeIcon(ctx, offsetPos, 'exclamation', nudgeColor, nodeAlpha);
          }
        }
      }

      // YOU drawn in world space, last so it stays on top.
      // YOU is the brightest star at the heart of the constellation; for
      // first-experience users we drop the dim factor and the "YOU" label.
      {
        const youHov = !!hoveredRef.current?.isCenter;
        const youDim = (!isFirstExperience && neighborSet && !neighborSet.has('you')) ? 0.40 : 1;
        const youDrawR = 44;
        drawStarNode(ctx, { x: youWorldX, y: youWorldY }, youDrawR, '#ffffff', youDim, youHov);
        if (isFirstExperience || youHov) {
          const bpm = 30;
          const pulse = (Math.sin(timeRef.current * (bpm / 60) * 0.05) + 1) / 2;
          const plusAlpha = (0.3 + 0.7 * pulse) * 0.4;
          ctx.fillStyle = `rgba(11,15,25,${plusAlpha})`;
          ctx.font = "300 36px 'Inter',sans-serif";
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('+', youWorldX, youWorldY);
        }
        if (!isFirstExperience) {
          ctx.fillStyle = `rgba(232,232,240,${0.95 * youDim})`;
          ctx.font = "500 11px 'Geist',system-ui,sans-serif";
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0.22em';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('YOU', youWorldX, youWorldY + youDrawR * 0.48 + 14);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }
      }

      if (isFirstExperience) {
        const FADE_START = 300; // ~1.8s transition + 1s delay
        const FADE_DURATION = 240;
        const SWAP_START = FADE_START + FADE_DURATION + 300; // ~3s after fully visible
        const SWAP_DURATION = 40;
        const baseAlpha = Math.min(1, Math.max(0, (timeRef.current - FADE_START) / FADE_DURATION)) * 0.85;
        const swapT = Math.min(1, Math.max(0, (timeRef.current - SWAP_START) / SWAP_DURATION));
        const firstAlpha = baseAlpha * (1 - swapT);
        const secondAlpha = baseAlpha * swapT;

        ctx.font = "300 35px 'Geist',system-ui,sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const greetingOffset = 40;
        const baseY = youWorldY + 44 + greetingOffset;
        if (firstAlpha > 0) {
          ctx.fillStyle = `rgba(200,200,210,${firstAlpha})`;
          ctx.fillText(`Talk to me, ${userName}.`, youWorldX, baseY);
        }
        if (secondAlpha > 0) {
          ctx.fillStyle = `rgba(200,200,210,${secondAlpha})`;
          ctx.fillText('Tap to talk.', youWorldX, baseY);
        }
      }

      ctx.restore();

      // Hover tooltip for person nodes — 170ms delay, then animate in
      const hov = hoveredRef.current;
      const HOVER_DELAY = 314;
      const ANIM_DUR = 140;
      if (hov && !hov.isCategory && !hov.isCenter && hoverStartRef.current) {
        const elapsed = performance.now() - hoverStartRef.current;
        if (elapsed >= HOVER_DELAY) {
          const t = Math.min(1, (elapsed - HOVER_DELAY) / ANIM_DUR);
          const ease = 1 - Math.pow(1 - t, 3);
          const scale = 0.85 + 0.15 * ease;
          const alpha = ease;
          const { cx: tcx, cy: tcy } = getCenter();
          const sx = (hov.x - tcx) * camRef.current.scale + tcx + camRef.current.x;
          const sy = (hov.y - tcy) * camRef.current.scale + tcy + camRef.current.y;
          const label = 'Shift+click to add to context';
          ctx.font = "500 8px 'Geist',system-ui,sans-serif";
          const tw = ctx.measureText(label).width;
          const ph = 8; const pv = 6;
          const bw = tw + ph * 2; const bh = 12 + pv * 2;
          const by = sy - hov.radius * camRef.current.scale - bh - 10;
          const offsetY = (1 - ease) * 4;
          ctx.save();
          ctx.translate(sx, by + bh / 2 + offsetY);
          ctx.scale(scale, scale);
          ctx.beginPath();
          ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 6);
          ctx.fillStyle = `rgba(11,15,25,${0.82 * alpha})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${0.15 * alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = `rgba(200,200,210,${0.9 * alpha})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }

      // Render particles in screen space
      for (const p of particlesRef.current) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = hexWithAlpha(p.color, p.alpha * 0.9);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    const onMouseLeave = () => {
      if (hoveredRef.current) {
        hoveredRef.current = null;
        hoverStartRef.current = 0;
        onHoverChangeRef.current?.(null);
      }
    };
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      if (panMomentumRef.current.raf) cancelAnimationFrame(panMomentumRef.current.raf);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [activeFilters, activeTool, initNodes, onNodeClick, onNodeDoubleClick, onSnip, onZoomOut, onZoomIn, deletingIds]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />;
}
