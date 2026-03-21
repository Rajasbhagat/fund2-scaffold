import 'server-only';
import fs from 'fs';
import path from 'path';

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
