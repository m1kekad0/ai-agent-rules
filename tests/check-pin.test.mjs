import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { checkRepo, parseProvenance, main, checkUpstream } from '../scripts/check-pin.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const COMMIT = 'a'.repeat(40);
const UPSTREAM = 'https://github.com/synthetic-owner/synthetic-rules';
const fixtureDirs = [];

async function repoDir() {
  const dir = await mkdtemp(join(tmpdir(), 'pin-test-'));
  fixtureDirs.push(dir);
  return dir;
}

// All tests stay offline, including those exercising the global fetch default.
beforeEach((t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network disabled in tests'); });
});
afterEach(async () => {
  await Promise.all(fixtureDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function fixture({
  agents = 'synthetic rules\n', license = 'synthetic license\n', recordAgents, recordLicense,
  upstream = 'https://example.invalid/rules', commit = COMMIT, vendorDir = 'vendor/ai-agent-rules',
} = {}) {
  const dir = await repoDir();
  const v = join(dir, vendorDir);
  await mkdir(v, { recursive: true });
  const ra = recordAgents ?? agents;
  const rl = recordLicense ?? license;
  await writeFile(join(v, 'AGENTS.md'), agents);
  await writeFile(join(v, 'LICENSE'), license);
  await writeFile(join(v, 'PROVENANCE.md'), [
    `- Upstream URL: ${upstream}`,
    `- Commit: \`${commit}\``,
    '- Path: `AGENTS.md`',
    `- Bytes: \`${Buffer.byteLength(ra)}\``,
    `- SHA256: \`${sha(ra)}\``,
    `- License bytes: \`${Buffer.byteLength(rl)}\``,
    `- License SHA256: \`${sha(rl)}\``,
    '',
  ].join('\n'));
  return dir;
}

test('parses all fields', () => {
  const { fields, missing } = parseProvenance(`- Commit: \`${COMMIT}\`\n- Bytes: \`3\``);
  assert.equal(fields.commit, COMMIT);
  assert.equal(fields.bytes, 3);
  assert.ok(missing.includes('sha256'));
});

test('matching pin is ok', async () => {
  const r = await checkRepo(await fixture());
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.equal(r.commit, COMMIT);
});

test('modified AGENTS.md is reported', async () => {
  const r = await checkRepo(await fixture({ agents: 'edited\n', recordAgents: 'original\n' }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.startsWith('AGENTS.md: sha256')));
});

test('modified LICENSE is reported', async () => {
  const r = await checkRepo(await fixture({ license: 'x\n', recordLicense: 'y\n' }));
  assert.ok(r.problems.some((p) => p.startsWith('LICENSE: sha256')));
});

test('missing provenance is reported', async () => {
  const dir = await repoDir();
  const r = await checkRepo(dir);
  assert.equal(r.ok, false);
});

test('cli exit codes', async () => {
  const sink = { buf: '', write(s) { this.buf += s; } };
  assert.equal(await main([await fixture()], sink), 0);
  assert.equal(await main([await fixture({ agents: 'a\n', recordAgents: 'b\n' })], sink), 1);
  assert.equal(await main(['--bogus'], sink), 2);
  const j = { buf: '', write(s) { this.buf += s; } };
  await main(['--json', await fixture()], j);
  assert.equal(JSON.parse(j.buf)[0].ok, true);
});


const sink = () => ({ buf: '', write(s) { this.buf += s; } });
const compare = (ahead_by = 0, files = [], history = {}) => ({
  ok: true, status: 200,
  json: async () => ({ status: ahead_by > 0 ? 'ahead' : 'identical', behind_by: 0, ahead_by, files, ...history }),
});

test('default text and JSON stay unchanged and never call fetch', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  const text = sink();
  const json = sink();
  assert.equal(await main([dir], text), 0);
  assert.equal(text.buf, `OK   ${dir} @ ${COMMIT.slice(0, 12)}\n`);
  assert.equal(await main(['--json', dir], json), 0);
  assert.deepEqual(JSON.parse(json.buf), [{ dir, ok: true, commit: COMMIT, problems: [] }]);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('upstream uses global fetch with a GET to the parsed repository and pin', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => compare(3, [{ filename: 'AGENTS.md' }]));
  const dir = await fixture({ upstream: UPSTREAM });
  const out = sink();
  assert.equal(await main(['--upstream', dir], out), 0);
  assert.match(out.buf, /upstream: ahead_by=3, AGENTS\.md changed=true, LICENSE changed=false/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, `https://api.github.com/repos/synthetic-owner/synthetic-rules/compare/${COMMIT}...main`);
  assert.equal(options.method, 'GET');
  assert.equal(options.redirect, 'error');
});

test('drift is informational unless --fail-on-drift is set', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  for (const name of ['AGENTS.md', 'LICENSE']) {
    const fetch = async () => compare(2, [{ filename: name }]);
    for (const strict of [false, true]) {
      const out = sink();
      const args = ['--json', '--upstream', ...(strict ? ['--fail-on-drift'] : []), dir];
      assert.equal(await main(args, out, { fetch }), strict ? 1 : 0);
      const [r] = JSON.parse(out.buf);
      assert.equal(r.ok, !strict);
      assert.deepEqual(r.upstream, {
        status: 'verified', ahead_by: 2, agentsChanged: name === 'AGENTS.md',
        licenseChanged: name === 'LICENSE', drift: true,
      });
    }
  }
});

test('ahead alone and file changes without ahead do not fail strict checks', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  for (const [ahead, files] of [
    [0, []], [5, [{ filename: 'README.md' }, { filename: 'docs/AGENTS.md' }]],
    [0, [{ filename: 'LICENSE' }]],
  ]) {
    const out = sink();
    assert.equal(await main(['--upstream', '--fail-on-drift', '--json', dir], out, {
      fetch: async () => compare(ahead, files),
    }), 0);
    assert.equal(JSON.parse(out.buf)[0].upstream.drift, false);
  }
});

test('non-forward histories are unverifiable even when only README.md is listed', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  for (const [status, ahead, behind_by] of [
    ['diverged', 2, 1], ['behind', 0, 1], ['behind', 0, 0],
    ['ahead', 2, 1], ['identical', 0, 1], ['unexpected', 0, 0], [undefined, 0, 0],
  ]) {
    const fetch = async () => compare(ahead, [{ filename: 'README.md' }], { status, behind_by });
    for (const strict of [false, true]) {
      for (const json of [false, true]) {
        const out = sink();
        const args = ['--upstream', ...(strict ? ['--fail-on-drift'] : []), ...(json ? ['--json'] : []), dir];
        assert.equal(await main(args, out, { fetch }), strict ? 1 : 0);
        if (json) {
          const [r] = JSON.parse(out.buf);
          assert.equal(r.ok, !strict);
          assert.deepEqual(r.upstream, { status: 'unverifiable', reason: 'diverged' });
        } else assert.ok(out.buf.includes('upstream: unverifiable (diverged)'));
      }
    }
  }
});

test('compare file lists at or above 300 are unverifiable and fail strict checks', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  for (const length of [299, 300, 301]) {
    const files = Array.from({ length }, (_, i) => ({ filename: `synthetic-${i}.md` }));
    const fetch = async () => compare(1, files);
    for (const strict of [false, true]) {
      for (const json of [false, true]) {
        const out = sink();
        const args = ['--upstream', ...(strict ? ['--fail-on-drift'] : []), ...(json ? ['--json'] : []), dir];
        assert.equal(await main(args, out, { fetch }), strict && length >= 300 ? 1 : 0);
        if (json) {
          const [r] = JSON.parse(out.buf);
          assert.equal(r.ok, !(strict && length >= 300));
          if (length >= 300) assert.deepEqual(r.upstream, { status: 'unverifiable', reason: 'file list limit' });
          else assert.equal(r.upstream.status, 'verified');
        } else if (length >= 300) assert.ok(out.buf.includes('upstream: unverifiable (file list limit)'));
      }
    }
  }
});

test('renaming either tracked upstream file counts as a change', async () => {
  const r = await checkUpstream({ upstream: UPSTREAM, commit: COMMIT }, {
    fetch: async () => compare(1, [
      { filename: 'ARCHIVED.md', previous_filename: 'AGENTS.md' },
      { filename: 'LICENSE', previous_filename: 'OLD-LICENSE' },
    ]),
  });
  assert.equal(r.agentsChanged, true);
  assert.equal(r.licenseChanged, true);
  assert.equal(r.drift, true);
});

test('HTTP and network failures are unverifiable, failing only in strict mode', async () => {
  const dir = await fixture({ upstream: UPSTREAM });
  for (const reason of ['404', '401', '403', '500', 'network']) {
    const fetch = async () => {
      if (reason === 'network') throw new Error('synthetic connection error');
      return { ok: false, status: Number(reason) };
    };
    for (const strict of [false, true]) {
      for (const json of [false, true]) {
        const out = sink();
        const args = ['--upstream', ...(strict ? ['--fail-on-drift'] : []), ...(json ? ['--json'] : []), dir];
        assert.equal(await main(args, out, { fetch }), strict ? 1 : 0);
        if (json) {
          const [r] = JSON.parse(out.buf);
          assert.equal(r.ok, !strict);
          assert.equal(r.upstream.status, 'unverifiable');
          assert.ok(r.upstream.reason.startsWith(reason));
        } else assert.ok(out.buf.includes(`upstream: unverifiable (${reason}`));
      }
    }
  }
});

test('GITHUB_TOKEN is sent in the header and never appears in text or JSON output', async (t) => {
  const token = 'synthetic-test-token-never-a-real-credential';
  const oldToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = token;
  t.after(() => {
    if (oldToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = oldToken;
  });
  const dir = await fixture({ upstream: UPSTREAM });
  for (const outcome of ['success', 'http', 'network', 'json']) {
    const requests = [];
    const fetch = async (url, options) => {
      requests.push({ url, options });
      if (outcome === 'network') throw new Error(`synthetic failure ${token}`);
      if (outcome === 'http') return { ok: false, status: 401, statusText: token, json: async () => ({ message: token }) };
      if (outcome === 'json') return { ok: true, json: async () => { throw new Error(token); } };
      return { ok: true, json: async () => ({
        status: 'ahead', behind_by: 0, ahead_by: 1,
        files: [{ filename: 'AGENTS.md', patch: token }], message: token,
      }) };
    };
    for (const json of [false, true]) {
      const out = sink();
      await main(['--upstream', ...(json ? ['--json'] : []), dir], out, { fetch });
      assert.ok(!out.buf.includes(token));
    }
    assert.equal(requests.length, 2);
    for (const { url, options } of requests) {
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      assert.ok(!url.includes(token));
    }
  }
});

test('no Authorization header is sent without an optional token', async () => {
  let called = false;
  const r = await checkUpstream({ upstream: `${UPSTREAM}.git/`, commit: COMMIT }, {
    token: '', fetch: async (url, options) => {
      called = true;
      assert.equal(url, `https://api.github.com/repos/synthetic-owner/synthetic-rules/compare/${COMMIT}...main`);
      assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
      return compare();
    },
  });
  assert.equal(called, true);
  assert.equal(r.status, 'verified');
});

test('unsupported or credential-bearing upstream URLs never cause a request', async () => {
  for (const upstream of [
    undefined, 'invalid', 'https://example.invalid/owner/repo',
    'https://github.com.example.invalid/owner/repo', 'http://github.com/owner/repo',
    'https://synthetic-token@github.com/owner/repo', 'https://github.com:8443/owner/repo',
    `${UPSTREAM}/tree/main`, `${UPSTREAM}?token=synthetic`, `${UPSTREAM}#fragment`,
  ]) {
    const r = await checkUpstream({ upstream, commit: COMMIT });
    assert.deepEqual(r, { status: 'unverifiable', reason: 'invalid metadata' });
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('invalid pin or missing provenance yields unverifiable upstream without fetch', async () => {
  const dir = await fixture({ upstream: UPSTREAM, commit: 'invalid' });
  const invalid = await checkRepo(dir, { upstream: true });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.upstream.reason, 'invalid metadata');
  const absent = await checkRepo(join(dir, 'missing'), { upstream: true });
  assert.equal(absent.upstream.reason, 'invalid metadata');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('malformed and capped compare responses are unverifiable', async () => {
  const cases = [
    [null, 'invalid response'], [{}, 'invalid response'],
    [{ ahead_by: '1', files: [] }, 'invalid response'],
    [{ ahead_by: -1, files: [] }, 'invalid response'],
    [{ ahead_by: 1 }, 'invalid response'],
    [{ ahead_by: 1, files: [null] }, 'invalid response'],
    [{ ahead_by: 1, files: [{ filename: 'AGENTS.md', previous_filename: 123 }] }, 'invalid response'],
    [{ status: 'ahead', behind_by: 0, ahead_by: 1,
      files: Array.from({ length: 300 }, (_, i) => ({ filename: `synthetic-${i}.md` })),
    }, 'file list limit'],
  ];
  for (const [body, reason] of cases) {
    const r = await checkUpstream({ upstream: UPSTREAM, commit: COMMIT }, {
      fetch: async () => ({ ok: true, json: async () => body }),
    });
    assert.deepEqual(r, { status: 'unverifiable', reason });
  }
});

test('upstream checks each repo, honors --vendor-dir, and preserves local pin failures', async () => {
  const vendorDir = 'custom-vendor/rules';
  const clean = await fixture({ upstream: UPSTREAM, vendorDir });
  const otherUpstream = 'https://github.com/another-synthetic-owner/rules';
  const otherCommit = 'b'.repeat(40);
  const dirty = await fixture({
    upstream: otherUpstream, commit: otherCommit, vendorDir, license: 'edited\n', recordLicense: 'original\n',
  });
  const calls = [];
  const out = sink();
  const code = await main(['--json', '--upstream', '--vendor-dir', vendorDir, clean, dirty], out, {
    fetch: async (url) => { calls.push(url); return compare(); },
  });
  assert.equal(code, 1);
  assert.deepEqual(calls, [
    `https://api.github.com/repos/synthetic-owner/synthetic-rules/compare/${COMMIT}...main`,
    `https://api.github.com/repos/another-synthetic-owner/rules/compare/${otherCommit}...main`,
  ]);
  const results = JSON.parse(out.buf);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.ok(results[1].problems.some((p) => p.startsWith('LICENSE: sha256')));
  assert.ok(results.every((r) => r.upstream.status === 'verified'));
});

test('--fail-on-drift requires explicit --upstream and help describes both', async () => {
  const out = sink();
  assert.equal(await main(['--fail-on-drift'], out), 2);
  assert.match(out.buf, /requires --upstream/);
  const help = sink();
  assert.equal(await main(['--help'], help), 0);
  assert.match(help.buf, /--upstream/);
  assert.match(help.buf, /--fail-on-drift/);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('Upstream: alias, angle brackets, backticks and trailing notes are accepted', () => {
  for (const line of [
    '- Upstream: `https://github.com/o/r`',
    '- Upstream: https://github.com/o/r（private）',
    '- Upstream URL: <https://github.com/o/r>',
    '- Upstream URL: https://github.com/o/r (note)',
  ]) assert.equal(parseProvenance(line).fields.upstream, 'https://github.com/o/r', line);
});

test('PROVENANCE template format with notes passes the local check', async () => {
  const dir = await repoDir();
  const v = join(dir, 'vendor/ai-agent-rules');
  await mkdir(v, { recursive: true });
  await writeFile(join(v, 'AGENTS.md'), 'a\n');
  await writeFile(join(v, 'LICENSE'), 'l\n');
  await writeFile(join(v, 'PROVENANCE.md'), [
    '- Upstream URL: <https://github.com/o/r>', `- Commit: \`${COMMIT}\``, '- Path: `AGENTS.md`',
    '- Retrieval date: 2026-10-16 UTC', '- Bytes: `2`', `- SHA256: \`${sha('a\n')}\``,
    '- License: MIT（確認日 2026-10-16）', '- License file: `LICENSE`（無改変）',
    '- License bytes: `2`（wc -c）', `- License SHA256: \`${sha('l\n')}\``, '',
  ].join('\n'));
  const r = await checkRepo(dir);
  assert.deepEqual(r.problems, []);
  assert.equal(r.commit, COMMIT);
});

test('private upstream 404 explains the token requirement without leaking it', async () => {
  const fetch = async () => ({ ok: false, status: 404 });
  const meta = { upstream: 'https://github.com/o/r', commit: COMMIT };
  const none = await checkUpstream(meta, { fetch, token: '' });
  assert.match(none.reason, /^404 .*GITHUB_TOKEN/);
  const withTok = await checkUpstream(meta, { fetch, token: 'secret-token-value' });
  assert.match(withTok.reason, /^404 .*token cannot read/);
  assert.ok(!JSON.stringify(withTok).includes('secret-token-value'));
});
