'use client';
import { useEffect, useState } from 'react';

const KEY = 'ecg_theme';
export type Theme = 'light' | 'dark';
const systemDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
function stored(): Theme | null { try { const v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch { return null; } }
function apply(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0B2545' : '#0F55A8');
}
/** Light / dark switch. Follows the phone or computer setting until the user picks one; then remembers the choice. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => { setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light'); }, []);
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next); apply(next);
    try { localStorage.setItem(KEY, next); } catch {}
  };
  return { theme, toggle };
}
/** Runs before the first paint (inline in <head>) so the page never flashes white. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
export { systemDark, stored };
