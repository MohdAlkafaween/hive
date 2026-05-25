import { TopNav } from "@/components/layout/TopNav";
import { IconSidebar } from "@/components/layout/IconSidebar";
import { GlobalProviders } from "@/components/GlobalProviders";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 40%, #1E1708 100%)' }}
    >
      {/* Ambient glow orbs */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-[#F5C518]/5 rounded-full blur-[150px] animate-pulse-slow pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#F5C518]/3 rounded-full blur-[120px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '1.5s' }} />
      <div className="fixed top-3/4 left-1/2 w-[300px] h-[300px] bg-[#F5C518]/4 rounded-full blur-[100px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '3s' }} />

      <TopNav />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <IconSidebar />
        <main className="flex-1 flex flex-col overflow-auto p-4 md:p-6">
          <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
            <GlobalProviders>{children}</GlobalProviders>
          </div>
        </main>
      </div>
      <footer className="relative z-10 py-3 px-4 text-xs font-mono"
        style={{
          borderTop: '1px solid rgba(245, 197, 24, 0.06)',
          background: 'rgba(0,0,0,0.3)',
          color: 'rgba(255,255,255,0.25)',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>HIVE.space &copy; 2026 Coworking Management Engine</span>
          <span className="hover:text-white/50 cursor-help font-medium transition-colors" title="F1: Search | F2: New Student | Esc: Dismiss">
            Keyboard hotkeys: [F1] [F2] [Esc]
          </span>
        </div>
      </footer>
    </div>
  );
}
