import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SolSensor',
  description: 'Solana sensor pool demo',
  icons: [
    { rel: 'icon', url: '/solana-favicon.svg', type: 'image/svg+xml' },
    { rel: 'shortcut icon', url: '/solana-favicon.svg', type: 'image/svg+xml' },
  ],
};

export default function IconLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
