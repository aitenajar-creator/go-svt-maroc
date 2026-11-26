const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root } = require('./helpers.cjs');

const source = fs.readFileSync(path.join(root, 'student-space.js'), 'utf8');
const cloudSource = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');

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
  assert.ok(source.includes('window.StudentSpace = {'));
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

test('study plan completion uses the cloud field and the platform UI field consistently', () => {
  assert.ok(source.includes('item.completed = item.done;'), 'workspace saves must persist the cloud completion field');
  assert.ok(source.includes('done: typeof remote.done === \'boolean\' ? remote.done : remote.completed === true'), 'cloud hydration must expose the UI completion field');
  assert.ok(cloudSource.includes('completed: item.completed === true'), 'cloud adapter must receive the canonical completion field');
});
