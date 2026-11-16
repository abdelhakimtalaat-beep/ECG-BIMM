App.start();

// تسجيل عامل الخدمة (يتيح تثبيت التطبيق على الهاتف بأيقونته)
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
