import { SERIES } from './series.mjs';
import fs from 'fs';
const have = new Set(fs.existsSync(process.argv[2] || '../../img/mon') ? fs.readdirSync(process.argv[2] || '../../img/mon').map((f) => f.replace('.webp', '')) : []);
const jobs = [];
for (const s of SERIES) {
  for (const id of [...s.N, ...s.R, ...s.SR, ...s.SSR]) if (!have.has(String(id))) jobs.push({ id, state: 'battle', yaw: 0.6, out: 'm' + id });
  for (const id of s.SSR) if (!have.has(id + 's')) jobs.push({ id, state: 'battle', yaw: 0.35, tilt: -0.04, shiny: true, out: 'm' + id + 's' });
}
fs.writeFileSync('jobs_all.json', JSON.stringify(jobs));
console.log('jobs', jobs.length);
