export const metadata = {
  title: 'MindShift — AI-Powered CBT Thought Records',
  description: 'Track your thoughts, identify cognitive distortions, and reframe your thinking with AI-guided CBT therapy.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-body antialiased">
        {children}
      </body>
    </html>
  );
}