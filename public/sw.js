// عامل خدمة بسيط لتمكين تثبيت التطبيق على الهاتف؛ لا يخزّن شيئاً (كل الطلبات تذهب للشبكة)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
