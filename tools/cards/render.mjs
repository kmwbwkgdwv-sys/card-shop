// アニモンの絵（カードのイラスト）を作る
// 使い方：アニモンのフォルダと tools/cards を同じサーバーで配信して
//   node render.mjs <port> <jobs.json> <outdir>
// 例：/animon/ にアニモン、/tools_render/portrait.html にこのフォルダの portrait.html があるとき
import { chromium } from 'playwright';
import fs from 'fs';
const [port, jobsPath, outDir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/tools_render/portrait.html?root=/animon`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
let n = 0;
for (const j of jobs) {
  const url = await page.evaluate((j) => window.renderMon(j.id, j.state, j.yaw, j.shiny, j.tilt), j);
  fs.writeFileSync(`${outDir}/${j.out}.png`, Buffer.from(url.split(',')[1], 'base64'));
  if (++n % 20 === 0) console.log('rendered', n);
}
await browser.close();
console.log('done', n);
