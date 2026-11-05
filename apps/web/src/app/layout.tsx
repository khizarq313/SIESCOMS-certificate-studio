import type { Metadata } from 'next';
import { DM_Sans, IBM_Plex_Mono, Newsreader } from 'next/font/google';
import '@siescoms/certificate/fonts.css';
import './globals.css';

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Certificate Studio · SIES College of Management Studies',
  description: 'Design certificates and send them to everyone on your list.',
  icons: { icon: '/api/static/assets/sun.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
