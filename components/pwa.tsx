'use client';
import { useEffect, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null;

/** Registers the service worker (needed for "Install app" on Android/desktop Chrome). */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const h = (e: Event) => { e.preventDefault(); deferred = e as InstallEvent; window.dispatchEvent(new Event('ecg-install-ready')); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return null;
}
export function useInstall() {
  const [ready, setReady] = useState(false); const [standalone, setStandalone] = useState(false); const [ios, setIos] = useState(false);
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setReady(!!deferred);
    const h = () => setReady(!!deferred); window.addEventListener('ecg-install-ready', h);
    return () => window.removeEventListener('ecg-install-ready', h);
  }, []);
  const install = async () => { if (!deferred) return false; await deferred.prompt(); deferred = null; setReady(false); return true; };
  return { ready, standalone, ios, install };
}
