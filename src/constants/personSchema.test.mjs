import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLANK_PERSON,
  buildPersonFromForm,
  buildPersonFromExtraction,
} from './personSchema.js';

test('buildPersonFromForm returns null for blank name', () => {
  assert.equal(buildPersonFromForm({ ...BLANK_PERSON(), name: '' }), null);
  assert.equal(buildPersonFromForm({ ...BLANK_PERSON(), name: '   ' }), null);
});

test('buildPersonFromForm produces full v2 shape with all 7 connection fields', () => {
  const result = buildPersonFromForm({
    ...BLANK_PERSON,
    name: 'Theo',
    relType: 'friend',
    tenure: 'lifetime',
    frequency: 'weekly',
    lastInteraction: 'this_week',
    channels: ['in_person', 'text'],
    theyShowUpForMe: 'yes',
    iShowUpForThem: 'yes',
    knowsAboutMe: 'most_of_it',
  });
  assert.equal(result.name, 'Theo');
  assert.equal(result.initials, 'T');
  assert.equal(result.relationship.type, 'friend');
  assert.equal(result.relationship.tenure, 'lifetime');
  assert.equal(result.relationship.frequency, 'weekly');
  assert.equal(result.relationship.last_interaction, 'this_week');
  assert.deepEqual(result.relationship.channels, ['in_person', 'text']);
  assert.equal(result.relationship.they_show_up_for_me, 'yes');
  assert.equal(result.relationship.i_show_up_for_them, 'yes');
  assert.equal(result.relationship.knows_about_me, 'most_of_it');
});

test('buildPersonFromForm drops invalid enum values to null', () => {
  const result = buildPersonFromForm({
    ...BLANK_PERSON,
    name: 'Test',
    tenure: 'forever',
    frequency: 'daily',
    channels: ['in_person', 'carrier_pigeon'],
  });
  assert.equal(result.relationship.tenure, null);
  assert.equal(result.relationship.frequency, 'daily');
  assert.deepEqual(result.relationship.channels, ['in_person']);
});

test('buildPersonFromForm omits empty notes / birthday fields', () => {
  const result = buildPersonFromForm({ ...BLANK_PERSON(), name: 'Test' });
  assert.equal('notes' in result, false);
  assert.equal('birthday' in result, false);
});

test('buildPersonFromExtraction returns null when name is missing', () => {
  assert.equal(buildPersonFromExtraction(null), null);
  assert.equal(buildPersonFromExtraction({}), null);
  assert.equal(buildPersonFromExtraction({ name: '' }), null);
});

test('buildPersonFromExtraction passes the 7 connection fields through', () => {
  const result = buildPersonFromExtraction({
    name: 'Sarah',
    relationship: {
      type: 'friend',
      tenure: 'few_years',
      frequency: 'weekly',
      last_interaction: 'today',
      channels: ['in_person', 'call'],
      they_show_up_for_me: 'yes',
      i_show_up_for_them: 'sometimes',
      knows_about_me: 'most_of_it',
    },
  });
  assert.equal(result.relationship.tenure, 'few_years');
  assert.equal(result.relationship.frequency, 'weekly');
  assert.equal(result.relationship.last_interaction, 'today');
  assert.deepEqual(result.relationship.channels, ['in_person', 'call']);
  assert.equal(result.relationship.they_show_up_for_me, 'yes');
  assert.equal(result.relationship.i_show_up_for_them, 'sometimes');
  assert.equal(result.relationship.knows_about_me, 'most_of_it');
});

test('buildPersonFromExtraction defaults to coherent skeleton when fields are missing', () => {
  const result = buildPersonFromExtraction({ name: 'Bob' });
  assert.equal(result.relationship.type, 'friend');
  assert.equal(result.relationship.tenure, null);
  assert.deepEqual(result.relationship.channels, []);
  assert.deepEqual(result.context.hobbies, []);
  assert.deepEqual(result.history.memories_together, []);
});

test('buildPersonFromForm maps context and history fields with trim', () => {
  const result = buildPersonFromForm({
    ...BLANK_PERSON(),
    name: 'Alice Bob',
    howWeMet: '  through college  ',
    school: 'UCLA',
    work: '',
    hobbies: ['reading', 'hiking'],
    sports: ['tennis'],
    favoritesFoods: ['ramen'],
    favoritesMusic: [],
    memoriesTogether: ['that one road trip'],
    importantEvents: [],
    thingsToLookForwardTo: ['summer plans'],
  });
  assert.equal(result.initials, 'AB');
  assert.equal(result.context.how_we_met, 'through college');
  assert.equal(result.context.school, 'UCLA');
  assert.equal(result.context.work, null);
  assert.deepEqual(result.context.hobbies, ['reading', 'hiking']);
  assert.deepEqual(result.context.favorites.foods, ['ramen']);
  assert.deepEqual(result.context.favorites.music, []);
  assert.deepEqual(result.history.memories_together, ['that one road trip']);
  assert.deepEqual(result.history.things_to_look_forward_to, ['summer plans']);
});

test('buildPersonFromExtraction trims context and notes whitespace for parity with form path', () => {
  const result = buildPersonFromExtraction({
    name: 'Carol',
    notes: '  some prose  ',
    context: {
      how_we_met: '  through work  ',
      school: '  UCLA  ',
      work: '   ',
    },
  });
  assert.equal(result.notes, 'some prose');
  assert.equal(result.context.how_we_met, 'through work');
  assert.equal(result.context.school, 'UCLA');
  assert.equal(result.context.work, null);
});
