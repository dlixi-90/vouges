// Read-only production browser check, using an isolated temporary Chrome profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const target = process.argv[2];
if (!target || !/^https:\/\/velours-jet\.vercel\.app\//u.test(target)) throw new Error('Pass a public Velours page URL');
const temporaryRoot = path.resolve(os.tmpdir());
const profile = await fs.mkdtemp(path.join(temporaryRoot, 'vouges-media-qa-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map();
let socket, counter = 0;
const errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++counter;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser timeout: ${method}`)); }, 20000);
  pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (value.exceptionDetails) throw new Error('Browser evaluation failed');
  return value.result.value;
};
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(100); }
  }
  if (!port) throw new Error('Chrome did not start');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find(row => row.type === 'page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id); if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: target });
  let state;
  for (let attempt = 0; attempt < 120; attempt++) {
    state = await evaluate(`({text:document.querySelector('main')?.innerText?.slice(0,100), migrated:document.querySelectorAll('img[src*="/velours/media-v2/"]').length})`);
    if (state.migrated) break; await pause(500);
  }
  if (!state.migrated) throw new Error('No migrated images rendered on the page');
  await evaluate(`document.querySelector('img[src*="/velours/media-v2/"]').scrollIntoView({block:'center'})`);
  let images;
  for (let attempt = 0; attempt < 60; attempt++) {
    images = await evaluate(`Array.from(document.querySelectorAll('img[src*="/velours/media-v2/"]')).map(img=>({loaded:img.complete&&img.naturalWidth>0,broken:img.complete&&img.naturalWidth===0,width:img.naturalWidth,height:img.naturalHeight}))`);
    if (images.some(img => img.loaded)) break; await pause(500);
  }
  if (!images.some(img => img.loaded) || images.some(img => img.broken) || errors.length) throw new Error('Migrated image or application failed in browser');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(500);
  const mobile = await evaluate(`({viewport:innerWidth,document:document.documentElement.scrollWidth})`);
  if (mobile.document > mobile.viewport + 2) throw new Error('Mobile page overflows horizontally');
  console.log(JSON.stringify({ page: target, migratedImages: images.length, loadedImages: images.filter(img => img.loaded).length, browserErrors: errors.length, mobile }));
} finally {
  socket?.close();
  for (const task of pending.values()) clearTimeout(task.timer);
  chrome.kill();
  await pause(1000);
  if (!path.resolve(profile).startsWith(path.join(temporaryRoot, 'vouges-media-qa-'))) throw new Error('Unexpected temporary browser directory');
  await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
