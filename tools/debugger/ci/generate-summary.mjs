import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * This script discovers TS samples, executes the TS-aware engine to collect findings,
 * and writes a detailed Markdown summary compatible with the expected PR comment format.
 * It does not sync to JSON on disk; data flows in-memory.
 */

function discoverSamples() {
  try {
    const out = execSync('find src/config/samples -name "*.ts" -type f', { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function evalTsToJson(tsPath) {
  const content = readFileSync(tsPath, 'utf8');
  const m = content.match(/export\s+const\s+(\w+)\s*:\s*FormConfig/);
  if (!m) return null;
  const name = m[1];
  const tmp = join(process.cwd(), `.tmp-eval-${name}.mts`);
    const src = `import 'tsconfig-paths/register';\nimport { ${name} } from '${tsPath}';\nconsole.log(JSON.stringify(${name}))`;
  writeFileSync(tmp, src, 'utf8');
    const json = execSync(`npx --yes tsx ${tmp}`, { encoding: 'utf8' });
  try { execSync(`rm -f ${tmp}`); } catch {}
  return JSON.parse(json);
}

async function runEngine(configObj) {
  const engine = await import(join(process.cwd(), 'tools/debugger/engine/index.mjs'));
  const run = engine.default || engine.runEngine || engine.run || engine;
  if (!run) throw new Error('Engine entry not found');
  // Assume run returns findings array when passed config
  const findings = await run({ config: configObj });
  return findings || [];
}

function summarizeCounts(findings) {
  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;
  const info = findings.filter(f => f.severity === 'info').length;
  const status = errors > 0 ? '❌ Failed' : (warnings > 0 ? '⚠️ Warnings' : '✅ Passed');
  return { errors, warnings, info, status };
}

function formatDetailed(sectionTitle, severityLabel, findings) {
  const parts = [];
  parts.push(sectionTitle);
  parts.push('');
  for (const f of findings) {
    parts.push(`📄 ${f.file || f.sample || 'config'}`);
    parts.push(f.title);
    parts.push('');
    parts.push(`Reason: ${f.explanation}`);
    parts.push('');
    const loc = Array.isArray(f.jsonPaths) ? f.jsonPaths.join(', ') : (f.location || 'N/A');
    parts.push(`Location: ${loc}`);
    parts.push('');
    const fixes = Array.isArray(f.fixGuidance) ? f.fixGuidance : Object.values(f.fixGuidance || {});
    if (severityLabel === 'info') {
      parts.push('Suggestions:');
    } else {
      parts.push('Fix:');
    }
    parts.push('');
    for (const suggestion of fixes) {
      parts.push(suggestion);
    }
  }
  return parts.join('\n');
}

async function main() {
  const samples = discoverSamples();
  const summaryLines = [];
  summaryLines.push('Debugger Summary');
  summaryLines.push('Config\tErrors\tWarnings\tInfo\tStatus');

  const warningsDetails = [];
  const infoDetails = [];

  for (const sample of samples) {
    const base = sample.split('/').pop().replace(/\.ts$/, '');
    const cfg = evalTsToJson(sample);
    if (!cfg) continue;
    const findings = await runEngine(cfg);
    // attach file for formatting
    for (const f of findings) f.sample = sample.split('/').pop();
    const { errors, warnings, info, status } = summarizeCounts(findings);
    summaryLines.push(`${base}\t${errors}\t${warnings}\t${info}\t${status}`);
    const warnFs = findings.filter(f => f.severity === 'warning');
    const infoFs = findings.filter(f => f.severity === 'info');
    if (warnFs.length) {
      warningsDetails.push(formatDetailed('⚠️ Warnings (Should Review)', 'warning', warnFs));
    }
    if (infoFs.length) {
      infoDetails.push('💡 Info & Suggestions (Optional Improvements)');
      infoDetails.push('');
      infoDetails.push(formatDetailed('', 'info', infoFs));
    }
  }

  const md = [];
  md.push(summaryLines.join('\n'));
  md.push('');
  if (warningsDetails.length) {
    md.push(warningsDetails.join('\n\n'));
  }
  if (infoDetails.length) {
    md.push('');
    md.push(infoDetails.join('\n\n'));
  }
  writeFileSync('summary.md', md.join('\n'), 'utf8');
}

main().catch(err => {
  const note = `Failed to generate summary: ${err?.message || err}`;
  writeFileSync('summary.md', note, 'utf8');
  process.exit(0);
});
