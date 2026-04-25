import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabeledSpeech } from './geminiLive.js';

const FULL_RESPONSE =
  'Name is Theo Lee. Relationship type is friend. Tenure is lifetime. ' +
  'Frequency is weekly. Last interaction is this_week. ' +
  'Channels are in_person, text. They show up for me is yes. ' +
  'I show up for them is yes. Knows about me is most_of_it. ' +
  'Birthday is 2003-08-14. Notes are Close friend since elementary school. ' +
  'How we met is unknown. School is unknown. Work is unknown. ' +
  'Hobbies are unknown. Sports are unknown. Favorite foods are unknown. ' +
  'Favorite music is unknown. Memories are unknown. ' +
  'Important events are unknown. Future plans are unknown.';

test('parseLabeledSpeech extracts all 7 connection fields', () => {
  const parsed = parseLabeledSpeech(FULL_RESPONSE);
  assert.equal(parsed.name, 'theo lee');
  assert.equal(parsed.relationship.type, 'friend');
  assert.equal(parsed.relationship.tenure, 'lifetime');
  assert.equal(parsed.relationship.frequency, 'weekly');
  assert.equal(parsed.relationship.last_interaction, 'this_week');
  assert.deepEqual(parsed.relationship.channels, ['in_person', 'text']);
  assert.equal(parsed.relationship.they_show_up_for_me, 'yes');
  assert.equal(parsed.relationship.i_show_up_for_them, 'yes');
  assert.equal(parsed.relationship.knows_about_me, 'most_of_it');
  assert.equal(parsed.birthday, '2003-08-14');
  assert.equal(parsed.notes, 'close friend since elementary school');
});

test('parseLabeledSpeech rejects invalid enum values to null', () => {
  const response =
    'Name is Test. Relationship type is friend. Tenure is forever. ' +
    'Frequency is sometimes. Last interaction is unknown. ' +
    'Channels are carrier_pigeon, text. They show up for me is unknown. ' +
    'I show up for them is unknown. Knows about me is unknown. ' +
    'Birthday is unknown. Notes are unknown. How we met is unknown. ' +
    'School is unknown. Work is unknown. Hobbies are unknown. ' +
    'Sports are unknown. Favorite foods are unknown. Favorite music is unknown. ' +
    'Memories are unknown. Important events are unknown. Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.relationship.tenure, null);
  assert.equal(parsed.relationship.frequency, null);
  assert.deepEqual(parsed.relationship.channels, ['text']);
});

test('parseLabeledSpeech treats "unknown" as null', () => {
  const response =
    'Name is Bob. Relationship type is friend. Tenure is unknown. ' +
    'Frequency is unknown. Last interaction is unknown. Channels are unknown. ' +
    'They show up for me is unknown. I show up for them is unknown. ' +
    'Knows about me is unknown. Birthday is unknown. Notes are unknown. ' +
    'How we met is unknown. School is unknown. Work is unknown. ' +
    'Hobbies are unknown. Sports are unknown. Favorite foods are unknown. ' +
    'Favorite music is unknown. Memories are unknown. Important events are unknown. ' +
    'Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.name, 'bob');
  assert.equal(parsed.relationship.tenure, null);
  assert.deepEqual(parsed.relationship.channels, []);
  assert.equal(parsed.relationship.they_show_up_for_me, null);
});

test('parseLabeledSpeech still parses legacy fields (notes, hobbies, etc.)', () => {
  const response =
    'Name is Maya. Relationship type is classmate. Tenure is months. ' +
    'Frequency is weekly. Last interaction is this_week. Channels are in_person. ' +
    'They show up for me is sometimes. I show up for them is sometimes. ' +
    'Knows about me is some_of_it. Birthday is unknown. ' +
    'Notes are Met through UPE. We had a long 1-on-1 conversation. ' +
    'How we met is UPE 1-on-1. School is UCLA. Work is unknown. ' +
    'Hobbies are reading, hiking. Sports are unknown. ' +
    'Favorite foods are unknown. Favorite music is unknown. ' +
    'Memories are unknown. Important events are unknown. Future plans are unknown.';
  const parsed = parseLabeledSpeech(response);
  assert.equal(parsed.notes, 'met through upe. we had a long 1-on-1 conversation');
  assert.equal(parsed.context.how_we_met, 'upe 1-on-1');
  assert.equal(parsed.context.school, 'ucla');
  assert.deepEqual(parsed.context.hobbies, ['reading', 'hiking']);
});
