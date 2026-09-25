import { writeFile } from 'node:fs/promises';
const source = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';
const response = await fetch(source);
if (!response.ok) throw new Error(`Holiday download failed: ${response.status}`);
const csv = new TextDecoder('shift_jis').decode(await response.arrayBuffer());
const holidays = {};
for (const line of csv.split(/\r?\n/)) {
  const match = line.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2}),(.+)$/);
  if (match) holidays[`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`] = match[4];
}
if (Object.keys(holidays).length < 1000) throw new Error('Unexpected holiday CSV format');
await writeFile(new URL('../public/holidays.js', import.meta.url), `// Source: ${source}\n// Refresh with npm run holidays:update. Dates outside the published range are not inferred.\nexport default ${JSON.stringify(holidays, null, 2)};\n`);
console.log(`Updated ${Object.keys(holidays).length} holidays (${Object.keys(holidays)[0]} – ${Object.keys(holidays).at(-1)})`);
