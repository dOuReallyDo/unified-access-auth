import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Unified Access Auth',
  description: 'Common authentication gateway for internal apps'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
