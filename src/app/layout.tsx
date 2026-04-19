import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MindShift — AI-Powered CBT Thought Records',
  description: 'Track your thoughts, identify cognitive distortions, and reframe your thinking with AI-guided CBT therapy.',
  keywords: ['CBT', 'therapy', 'thought records', 'cognitive distortions', 'mental health', 'AI'],
  openGraph: {
    title: 'MindShift — AI-Powered CBT Thought Records',
    description: 'Track your thoughts, identify cognitive distortions, and reframe your thinking.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-navy font-body antialiased">
        {children}
      </body>
    </html>
  );
}