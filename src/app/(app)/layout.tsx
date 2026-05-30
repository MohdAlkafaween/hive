import { TopNav } from "@/components/layout/TopNav";
import { IconSidebar } from "@/components/layout/IconSidebar";
import { GlobalProviders } from "@/components/GlobalProviders";
import { AppLayoutInner } from "@/components/layout/AppLayoutInner";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayoutInner>
      <ToastProvider>
        <TopNav />
        <div className="flex flex-1 overflow-hidden relative z-10">
          <IconSidebar />
          <main className="flex-1 flex flex-col overflow-auto p-4 md:p-6">
            <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
              <ErrorBoundary>
                <GlobalProviders>{children}</GlobalProviders>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </ToastProvider>
    </AppLayoutInner>
  );
}
