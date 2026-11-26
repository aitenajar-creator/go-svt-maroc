const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./helpers.cjs');

const source = fs.readFileSync(path.join(root, 'student-space.js'), 'utf8');

test('workspace record bridge is exported without removing legacy student APIs', () => {
  for (const name of [
    'saveWorkspaceRecord',
    'deleteWorkspaceRecord',
    'getProfileData',
    'markLessonComplete',
    'updateProgress',
    'mergeCloudProgress',
    'exportProfileData'
  ]) {
    assert.match(source, new RegExp('\\b' + name + '\\b'));
  }
  assert.match(source, /window\\.StudentSpace\\s*=\\s*\\{/);
});

test('workspace writes are bound to the expected authenticated student profile', () => {
  const start = source.indexOf('function workspaceContext(expectedUid)');
  const end = source.indexOf('function saveWorkspaceRecord', start);
  assert.ok(start >= 0 && end > start, 'workspaceContext must be defined before writes');
  const guard = source.slice(start, end);
  for (const check of [
    'account.isReady()',
    'account.isLoggedIn()',
    'user.id !== expectedUid',
    'account.activeProfileId() !== currentProfileId',
    "account.getProfile()?.role !== 'student'"
  ]) assert.ok(guard.includes(check), 'missing identity guard: ' + check);
});

test('workspace record operations validate input and retain existing cloud deletion queue', () => {
  const start = source.indexOf('function saveWorkspaceRecord');
  const end = source.indexOf('// 2. LANGUAGE SYSTEM', start);
  assert.ok(start >= 0 && end > start, 'workspace record functions must exist');
  const bridge = source.slice(start, end);
  for (const check of [
    "['note', 'task'].includes(kind)",
    'title.length > 180',
    'item.body.length > 5000',
    'Date.parse(item.date)',
    'saveProfileData(context.id, context.data)',
    "queueCloudDeletion(kind === 'note' ? 'notes' : 'studyPlan', id, context.uid)"
  ]) assert.ok(bridge.includes(check), 'missing workspace safeguard: ' + check);
});
