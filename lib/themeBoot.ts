// Server-safe constants for dark mode (kept out of the 'use client' module so the root layout can import them).
export const THEME_KEY = 'ecg_theme';
/** Runs before the first paint (inline in <head>) so the page never flashes white. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;
