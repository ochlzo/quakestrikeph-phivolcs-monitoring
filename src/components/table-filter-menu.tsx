"use client"

import type { ReactNode } from "react"
import { FunnelIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TableFilterMenu({
  title,
  description,
  activeFilterCount,
  children,
}: {
  title: string
  description: string
  activeFilterCount: number
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <FunnelIcon />
        Filter
        {activeFilterCount > 0 ? (
          <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-foreground">
            {activeFilterCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        <header className="border-b p-4">
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </header>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
