import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const modulePath = process.env.OWS_BINDING_MODULE;
const ows = await import(pathToFileURL(modulePath).href);
if (process.argv.includes('--worker')) {
  const { vault, wallet, token, deny } = JSON.parse(readFileSync(0, 'utf8'));
  const run = () => ows.signMessage(wallet, 'base', 'offline concurrency probe', token, null, null, vault);
  if (deny) assert.throws(run, /Cumulative spending accounting unavailable/);
  else assert.ok(run().signature.length > 0);
  process.stdout.write('ok');
} else {
  const vault = mkdtempSync(join(tmpdir(), 'ows-node-spending-'));
  try {
    const wallet = ows.createWallet('compatibility-only', undefined, 12, vault);
    const policyPath = join(vault, 'availability-policy.js');
    writeFileSync(policyPath, `#!${process.execPath}\n` + `
const fs = require('node:fs');
const ctx = JSON.parse(fs.readFileSync(0, 'utf8'));
if (!ctx.spending || !Object.hasOwn(ctx.spending, 'daily_total') || ctx.spending.daily_total !== null || ctx.spending.date !== ctx.timestamp.slice(0,10)) {
  process.stdout.write(JSON.stringify({allow:false,reason:'Unexpected accounting context'}));
} else {
  process.stdout.write(JSON.stringify({allow:ctx.policy_config.mode === 'allow',reason:'Cumulative spending accounting unavailable'}));
}
`, { mode: 0o700 });
    const keys = {};
    for (const mode of ['allow', 'deny']) {
      ows.createPolicy(JSON.stringify({ id: mode, name: mode, version: 1,
        created_at: '2026-03-22T00:00:00Z', rules: [], executable: policyPath,
        config: { mode }, action: 'deny' }), vault);
      keys[mode] = ows.createApiKey(mode, [wallet.id], [mode], '', null, vault);
    }
    const token = keys.deny.token;
    const typed = JSON.stringify({types:{EIP712Domain:[],Message:[]},primaryType:'Message',domain:{},message:{}});
    for (const operation of [
      () => ows.signTransaction(wallet.id, 'base', '00'.repeat(32), token, null, vault),
      () => ows.signMessage(wallet.id, 'base', 'hello', token, null, null, vault),
      () => ows.signHash(wallet.id, 'base', '00'.repeat(32), token, null, vault),
      () => ows.signTypedData(wallet.id, 'base', typed, token, null, vault),
    ]) assert.throws(operation, /Cumulative spending accounting unavailable/);
    const child = deny => new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
        stdio: ['pipe', 'pipe', 'pipe'], env: process.env,
      });
      let stdout = '', stderr = '';
      proc.stdout.on('data', chunk => stdout += chunk);
      proc.stderr.on('data', chunk => stderr += chunk);
      proc.on('error', reject);
      proc.on('close', code => {
        if (code !== 0 || stdout !== 'ok') reject(new Error(`child failed: ${code} ${stderr}`));
        else resolve();
      });
      proc.stdin.end(JSON.stringify({vault,wallet:wallet.id,token:keys[deny ? 'deny' : 'allow'].token,deny}));
    });
    for (let batch = 0; batch < 2; batch++) {
      await Promise.all(Array.from({length: 4}, () => child(false)));
      await Promise.all(Array.from({length: 4}, () => child(true)));
    }
    assert.equal(Number(null), 0);
    assert.equal(null || '0', '0');
    assert.throws(() => BigInt(null), TypeError);
    console.log('PASS: Node native null contract; 4 signing operations deny; 8 allowed signatures and 8 denials in fresh processes, 4 concurrent per batch; coercion caveat verified. No cumulative ledger claimed.');
  } finally { rmSync(vault, { recursive: true, force: true }); }
}
