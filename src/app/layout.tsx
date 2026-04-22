import './globals.css';

export const metadata = {
  title: 'MindShift — AI-Powered CBT Thought Records',
  description: 'Track your thoughts, identify cognitive distortions, and reframe your thinking with AI-guided CBT therapy.',
  icons: { icon: '/icon.svg' },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="min-h-screen font-body antialiased touch-manipulation">
        {children}
      </body>
    </html>
  );
}