import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export function PortalShell({
  activePath,
  operatorEmail,
  operatorDisplayName,
  children,
}: {
  activePath: string;
  operatorEmail: string;
  operatorDisplayName: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar
          activePath={activePath}
          operator={{ name: operatorDisplayName || 'Operator', email: operatorEmail }}
        />
        <div className="flex min-h-svh min-w-0 flex-1 flex-col">
          <header className="relative z-10 flex h-12 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
          </header>
          {children}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
