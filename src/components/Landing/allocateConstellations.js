import { RELATIONSHIP_TYPES } from '../../constants/personSchema';
import { LIBRARY } from './constellationLibrary';

const MIN_STARS = 3;
const MAX_GROUPS = 2;

const colorByType = Object.fromEntries(RELATIONSHIP_TYPES.map((t) => [t.key, t.color]));
const labelByType = Object.fromEntries(RELATIONSHIP_TYPES.map((t) => [t.key, t.label]));

// Pick a random unused constellation tied at the largest starCount <= count.
const pickBestFit = (used, count) => {
  if (count < MIN_STARS) return null;
  let best = -1;
  for (const c of LIBRARY) {
    if (used.has(c.name)) continue;
    if (c.starCount <= count && c.starCount > best) best = c.starCount;
  }
  if (best < 0) return null;
  const candidates = LIBRARY.filter((c) => !used.has(c.name) && c.starCount === best);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const peopleToStars = (people, shape) => shape.stars.map((unit, i) => {
  const p = people[i];
  return {
    ux: unit[0],
    uy: unit[1],
    color: colorByType[p?.relType] || colorByType.other,
    person: p || null,
  };
});

export const allocateConstellations = (people) => {
  const used = new Set();
  const groups = [];
  const leftover = [];

  for (const type of RELATIONSHIP_TYPES) {
    if (groups.length >= MAX_GROUPS) break;
    const inCat = people.filter((p) => p.relType === type.key);
    if (inCat.length === 0) continue;
    const shape = pickBestFit(used, inCat.length);
    if (!shape) {
      leftover.push(...inCat);
      continue;
    }
    used.add(shape.name);
    const assigned = inCat.slice(0, shape.starCount);
    const extras = inCat.slice(shape.starCount);
    leftover.push(...extras);
    groups.push({
      shapeName: shape.name,
      label: labelByType[type.key],
      stars: peopleToStars(assigned, shape),
      edges: shape.edges,
    });
  }

  while (leftover.length >= MIN_STARS && groups.length < MAX_GROUPS) {
    const shape = pickBestFit(used, leftover.length);
    if (!shape) break;
    used.add(shape.name);
    const assigned = leftover.splice(0, shape.starCount);
    groups.push({
      shapeName: shape.name,
      label: shape.name,
      stars: peopleToStars(assigned, shape),
      edges: shape.edges,
    });
  }

  return groups;
};
