// Single source of truth for the Person JSON contract (schema v2).
// Both intake paths (voice + form) import from here; the scorer
// consumes JSON shaped by the builders below.

export const RELATIONSHIP_TYPES = [
  { key: 'family',       label: 'Family',        color: '#e8b06b' },
  { key: 'friend',       label: 'Friend',        color: '#ffce5c' },
  { key: 'classmate',    label: 'School',        color: '#b9d0ff' },
  { key: 'coworker',     label: 'Work',          color: '#9be6c4' },
  { key: 'professional', label: 'Professional',  color: '#ff9c5a' },
  { key: 'romantic',     label: 'Romantic',      color: '#ffc8d6' },
  { key: 'mentor',       label: 'Mentor',        color: '#7df9ff' },
  { key: 'other',        label: 'Other',         color: '#cdc9c0' },
];

export const TENURE_OPTIONS = [
  { key: 'just_met',  label: 'Just met'      },
  { key: 'months',    label: 'A few months'  },
  { key: 'one_year',  label: 'About a year'  },
  { key: 'few_years', label: 'A few years'   },
  { key: 'five_plus', label: '5+ years'      },
  { key: 'lifetime',  label: 'A lifetime'    },
];

export const FREQUENCY_OPTIONS = [
  { key: 'daily',            label: 'Daily'           },
  { key: 'weekly',           label: 'Weekly'          },
  { key: 'monthly',          label: 'Monthly'         },
  { key: 'few_times_a_year', label: 'A few times/yr'  },
  { key: 'rarely',           label: 'Rarely'          },
];

export const LAST_INTERACTION_OPTIONS = [
  { key: 'today',       label: 'Today'       },
  { key: 'this_week',   label: 'This week'   },
  { key: 'this_month',  label: 'This month'  },
  { key: 'this_season', label: 'This season' },
  { key: 'this_year',   label: 'This year'   },
  { key: 'over_a_year', label: 'Over a year' },
];

export const CHANNEL_OPTIONS = [
  { key: 'in_person',  label: 'In person' },
  { key: 'text',       label: 'Text'      },
  { key: 'call',       label: 'Calls'     },
  { key: 'video_call', label: 'Video'     },
  { key: 'dm',         label: 'DMs'       },
  { key: 'email',      label: 'Email'     },
  { key: 'other',      label: 'Other'     },
];

export const SUPPORT_OPTIONS = [
  { key: 'yes',        label: 'Yes'        },
  { key: 'sometimes',  label: 'Sometimes'  },
  { key: 'not_really', label: 'Not really' },
  { key: 'not_sure',   label: 'Not sure'   },
];

export const KNOWS_OPTIONS = [
  { key: 'most_of_it', label: 'Most of it' },
  { key: 'some_of_it', label: 'Some of it' },
  { key: 'not_really', label: 'Not really' },
  { key: 'not_sure',   label: 'Not sure'   },
];

const keysOf = (opts) => opts.map((o) => o.key);
export const TENURE_KEYS           = keysOf(TENURE_OPTIONS);
export const FREQUENCY_KEYS        = keysOf(FREQUENCY_OPTIONS);
export const LAST_INTERACTION_KEYS = keysOf(LAST_INTERACTION_OPTIONS);
export const CHANNEL_KEYS          = keysOf(CHANNEL_OPTIONS);
export const SUPPORT_KEYS          = keysOf(SUPPORT_OPTIONS);
export const KNOWS_KEYS            = keysOf(KNOWS_OPTIONS);
export const RELATIONSHIP_TYPE_KEYS = keysOf(RELATIONSHIP_TYPES);

// Empty form state used by AddPersonModal.
export const BLANK_PERSON = {
  name: '',
  birthday: '',
  relType: 'friend',
  notes: '',

  // Connection (the 7 new structured fields)
  tenure: null,
  frequency: null,
  lastInteraction: null,
  channels: [],
  theyShowUpForMe: null,
  iShowUpForThem: null,
  knowsAboutMe: null,

  // Context
  howWeMet: '',
  school: '',
  work: '',
  hobbies: [],
  sports: [],
  favoritesFoods: [],
  favoritesMusic: [],

  // Memories
  memoriesTogether: [],
  importantEvents: [],
  thingsToLookForwardTo: [],
};

// Helper: validate enum-or-null. Returns the value if it's in `keys`,
// otherwise null. Use for fields where invalid input should be dropped.
function enumOrNull(value, keys) {
  return value && keys.includes(value) ? value : null;
}

function arrayFiltered(value, keys) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => keys.includes(v));
}

// Build canonical Person JSON from the form's local state.
// `formState` matches BLANK_PERSON shape.
export function buildPersonFromForm(formState) {
  const rawName = (formState.name || '').trim();
  if (!rawName) return null;

  const initials = rawName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const id = String(Date.now());

  return {
    id,
    name: rawName,
    initials,
    ...(formState.birthday ? { birthday: formState.birthday } : {}),
    ...(formState.notes?.trim() ? { notes: formState.notes.trim() } : {}),

    relationship: {
      type: enumOrNull(formState.relType, RELATIONSHIP_TYPE_KEYS) || 'friend',
      tenure:              enumOrNull(formState.tenure,           TENURE_KEYS),
      frequency:           enumOrNull(formState.frequency,        FREQUENCY_KEYS),
      last_interaction:    enumOrNull(formState.lastInteraction,  LAST_INTERACTION_KEYS),
      channels:            arrayFiltered(formState.channels,      CHANNEL_KEYS),
      they_show_up_for_me: enumOrNull(formState.theyShowUpForMe,  SUPPORT_KEYS),
      i_show_up_for_them:  enumOrNull(formState.iShowUpForThem,   SUPPORT_KEYS),
      knows_about_me:      enumOrNull(formState.knowsAboutMe,     KNOWS_KEYS),
    },

    context: {
      how_we_met: formState.howWeMet?.trim() || null,
      school:     formState.school?.trim()   || null,
      work:       formState.work?.trim()     || null,
      hobbies:    formState.hobbies    || [],
      sports:     formState.sports     || [],
      favorites:  {
        foods: formState.favoritesFoods || [],
        music: formState.favoritesMusic || [],
      },
    },

    history: {
      memories_together:         formState.memoriesTogether      || [],
      important_events:          formState.importantEvents       || [],
      things_to_look_forward_to: formState.thingsToLookForwardTo || [],
    },
  };
}

// Build canonical Person JSON from the Gemini extraction object.
// Tolerant of partial/missing fields — defaults to a coherent skeleton.
export function buildPersonFromExtraction(extracted) {
  if (!extracted) return null;
  const rawName = (extracted.name || '').trim();
  if (!rawName) return null;

  const initials = rawName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const id = String(Date.now());
  const rel = extracted.relationship || {};
  const ctx = extracted.context || {};
  const hist = extracted.history || {};

  return {
    id,
    name: rawName,
    initials,
    ...(extracted.birthday ? { birthday: extracted.birthday } : {}),
    ...(extracted.notes ? { notes: extracted.notes } : {}),

    relationship: {
      type: enumOrNull(rel.type, RELATIONSHIP_TYPE_KEYS) || 'friend',
      tenure:              enumOrNull(rel.tenure,              TENURE_KEYS),
      frequency:           enumOrNull(rel.frequency,           FREQUENCY_KEYS),
      last_interaction:    enumOrNull(rel.last_interaction,    LAST_INTERACTION_KEYS),
      channels:            arrayFiltered(rel.channels,         CHANNEL_KEYS),
      they_show_up_for_me: enumOrNull(rel.they_show_up_for_me, SUPPORT_KEYS),
      i_show_up_for_them:  enumOrNull(rel.i_show_up_for_them,  SUPPORT_KEYS),
      knows_about_me:      enumOrNull(rel.knows_about_me,      KNOWS_KEYS),
    },

    context: {
      how_we_met: ctx.how_we_met || null,
      school:     ctx.school     || null,
      work:       ctx.work       || null,
      hobbies:    ctx.hobbies    || [],
      sports:     ctx.sports     || [],
      favorites:  {
        foods: ctx.favorites?.foods || [],
        music: ctx.favorites?.music || [],
      },
    },

    history: {
      memories_together:         hist.memories_together         || [],
      important_events:          hist.important_events          || [],
      things_to_look_forward_to: hist.things_to_look_forward_to || [],
    },
  };
}
