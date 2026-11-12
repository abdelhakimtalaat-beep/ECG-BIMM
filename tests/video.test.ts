import test from 'node:test';
import assert from 'node:assert/strict';
import { videoSrc } from '../lib/video.ts';

test('video links: files, YouTube, Vimeo, Drive, others, invalid', () => {
  assert.deepEqual(videoSrc('https://x.com/a/b.MP4?token=1'), { kind: 'file', src: 'https://x.com/a/b.MP4?token=1', open: 'https://x.com/a/b.MP4?token=1' });
  assert.equal(videoSrc('https://www.youtube.com/watch?v=abcDEF12345&t=3')!.src, 'https://www.youtube-nocookie.com/embed/abcDEF12345');
  assert.equal(videoSrc('https://youtu.be/abcDEF12345')!.src, 'https://www.youtube-nocookie.com/embed/abcDEF12345');
  assert.equal(videoSrc('https://www.youtube.com/shorts/abcDEF12345')!.src, 'https://www.youtube-nocookie.com/embed/abcDEF12345');
  assert.equal(videoSrc('https://vimeo.com/123456')!.src, 'https://player.vimeo.com/video/123456');
  assert.equal(videoSrc('https://drive.google.com/file/d/AbC_1-x/view?usp=sharing')!.src, 'https://drive.google.com/file/d/AbC_1-x/preview');
  assert.deepEqual(videoSrc('https://ecg.sharepoint.com/sites/bim/video'), { kind: 'embed', src: 'https://ecg.sharepoint.com/sites/bim/video', open: 'https://ecg.sharepoint.com/sites/bim/video' });
  assert.equal(videoSrc('https://acc.autodesk.com/docs/files/projects/1?folderUrn=x')!.kind, 'external');
  assert.equal(videoSrc('https://construction.autodesk.com/a')!.kind, 'external');
  assert.equal(videoSrc('https://notautodesk.com/a')!.kind, 'embed');
  for (const bad of ['', null, undefined, 'javascript:alert(1)', 'file:///c/a.mp4', '\\\\ecg-server\\share\\a.mp4', 'not a url']) assert.equal(videoSrc(bad as any), null, String(bad));
});
