import 'server-only';
import fs from 'fs';
import path from 'path';

export function getFAROContext(): string {
  const faroDir = path.join(process.cwd(), 'src', 'context', 'faro');

  const systemPrompt = fs.readFileSync(
    path.join(faroDir, 'faro-system-prompt.txt'),
    'utf-8'
  );

  const fund2Syllabus = fs.readFileSync(
    path.join(faroDir, 'fund2-syllabus.txt'),
    'utf-8'
  );

  const electiveSummaries = fs.readFileSync(
    path.join(faroDir, 'elective-summaries.txt'),
    'utf-8'
  );

  return (
    systemPrompt +
    '\n\n[FARO KNOWLEDGE BASE — FUND II Course Navigator]\nPriority: Consult pre-loaded course materials before searching the web.\n' +
    '\n=== FUND II SYLLABUS ===\n' +
    fund2Syllabus +
    '\n\n' +
    electiveSummaries
  );
}

export function getSystemContext(): string {
  const contextDir = path.join(process.cwd(), 'src', 'context');

  const systemPrompt = fs.readFileSync(
    path.join(contextDir, 'system-prompt.txt'),
    'utf-8'
  );

  const megatrendDocs = [1, 2, 3, 4].map((n) =>
    fs.readFileSync(path.join(contextDir, `megatrend-${n}.txt`), 'utf-8')
  );

  return [systemPrompt, ...megatrendDocs].join('\n\n---KNOWLEDGE BASE DOCUMENT---\n\n');
}
