"use client"

import {
  BellIcon,
  ClipboardListIcon,
  DatabaseIcon,
  MapIcon,
  ScrollTextIcon,
  TerminalIcon,
} from "lucide-react"

import {
  EventSidebarPanel,
  type EventSidebarPanelProps,
} from "@/components/event-sidebar-panel"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const NAV = [
  { href: "/", label: "Monitor", icon: MapIcon },
  { href: "/forecasts", label: "Forecasts", icon: ClipboardListIcon },
  { href: "/logs", label: "Logs", icon: ScrollTextIcon },
  { href: "", label: "Alerts — coming soon", icon: BellIcon, disabled: true },
  { href: "/events", label: "Raw events", icon: DatabaseIcon },
] as const

export function AppSidebar(props: EventSidebarPanelProps) {
  const mobileNavigation = (
    <nav aria-label="Portal navigation">
      <ul className="grid grid-cols-3 gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <li key={label}>
            {href ? (
              <a href={href} aria-current={href === "/" ? "page" : undefined} className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-center text-[11px] hover:bg-sidebar-accent">
                <Icon className="size-4" />
                <span>{label}</span>
              </a>
            ) : (
              <span aria-disabled="true" className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-center text-[11px] text-muted-foreground opacity-60">
                <Icon className="size-4" />
                <span>{label}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
    >
      <Sidebar
        collapsible="none"
        className="hidden w-[calc(var(--sidebar-width-icon)+1px)]! border-r md:flex"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="QuakeStrike PH"
                render={<a href="/" />}
                className="md:h-8 md:p-0"
              >
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon />
                </span>
                <span className="sr-only">QuakeStrike PH</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {NAV.map(({ href, label, icon: Icon, ...item }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      tooltip={{ children: label, hidden: false }}
                      isActive={href === "/"}
                      disabled={"disabled" in item}
                      render={href ? <a href={href} /> : undefined}
                      className="px-2.5 md:px-2"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={props.operator} />
        </SidebarFooter>
      </Sidebar>

      <EventSidebarPanel {...props} mobileNavigation={mobileNavigation} />
    </Sidebar>
  )
}
