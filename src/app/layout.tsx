import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Samvada - Smart AI Assistant',
  description: 'A premium conversational space powered by foundation models.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
