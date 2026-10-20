import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'pickme-storage-'));
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'local';
process.env.UPLOAD_DIR = path.join(root, 'uploads');
process.env.APP_URL = 'https://pickme.example';
const { blobStorageService: storage } = await import('../dist/services/blob-storage.service.js');
after(() => rm(root, { recursive: true, force: true }));

test('local uploads use distinct names and can be read and deleted', async () => {
  const options = {folder:'items',filename:'photo.webp',buffer:Buffer.from('test-image'),contentType:'image/webp'};
  const first = await storage.uploadPublicFile(options);
  const second = await storage.uploadPublicFile(options);
  assert.notEqual(first.pathname, second.pathname);
  assert.equal(first.url, `https://pickme.example/uploads/${first.pathname}`);
  assert.equal((await readFile(path.join(process.env.UPLOAD_DIR,first.pathname))).toString(),'test-image');
  await storage.deleteByUrl(first.url);
  await assert.rejects(readFile(path.join(process.env.UPLOAD_DIR, first.pathname)), {code:'ENOENT'});
  await storage.deleteByUrl(first.url);
  assert.equal((await readFile(path.join(process.env.UPLOAD_DIR,second.pathname))).toString(),'test-image');
});

test('deletion cannot leave upload directory or remove another host file', async () => {
  const outside = path.join(root,'protected.txt');
  await writeFile(outside,'keep');
  await storage.deleteByUrl('https://pickme.example/uploads/%2e%2e/protected.txt');
  const uploaded = await storage.uploadPublicFile({folder:'avatars',filename:'photo.png',buffer:Buffer.from('keep'),contentType:'image/png'});
  await storage.deleteByUrl(uploaded.url.replace('pickme.example','other.example'));
  assert.equal(await readFile(outside,'utf8'),'keep');
  assert.equal(await readFile(path.join(process.env.UPLOAD_DIR,uploaded.pathname),'utf8'),'keep');
});

test('upload rejects traversal folders', async () => {
  await assert.rejects(storage.uploadPublicFile({folder:'../outside',filename:'photo.png',buffer:Buffer.from('x'),contentType:'image/png'}));
});
