import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa';
import { THEME_BOOT } from '@/lib/themeBoot';

export const metadata: Metadata = { title: 'ECG BIM Department Management Portal', description: 'Projects, teams, workload and training for the ECG BIM Management Department', icons: { icon: '/ecg-logo.png', apple: '/apple-touch-icon.png' }, manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'ECG BIM', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0F55A8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head><body><PwaRegister />{children}</body></html>);
}
