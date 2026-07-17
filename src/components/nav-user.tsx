import * as React from "react"
import { ChevronsUpDownIcon, UserRoundIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1
    ? `${parts[0][0]}${parts.at(-1)![0]}`.toUpperCase()
    : (parts[0]?.slice(0, 2).toUpperCase() ?? "PH")
}

export function NavUser({ user }: { user: { name: string; email: string } }) {
  const { isMobile } = useSidebar()
  const [name, setName] = React.useState(user.name)
  const [draft, setDraft] = React.useState(user.name)
  const [status, setStatus] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatus("")
    const response = await fetch("/api/operator-profile", {
      method: "POST",
      body: new FormData(event.currentTarget),
    })
    const data = (await response.json()) as { display_name?: string; error?: string }
    if (response.ok && data.display_name) {
      setName(data.display_name)
      setDraft(data.display_name)
      setStatus("Profile saved.")
    } else {
      setStatus(data.error ?? "Could not save profile.")
    }
    setSaving(false)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip="Operator profile"
                className="md:h-8 md:p-0 data-open:bg-sidebar-accent"
              />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name || "Operator"}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[min(22rem,calc(100vw-2rem))] rounded-lg p-3"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-2 px-0 pb-2">
              <UserRoundIcon className="size-4 text-primary" />
              PHIVOLCS operator profile
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form className="space-y-3 pt-2" onSubmit={save}>
              <div className="space-y-1.5">
                <Label htmlFor="operator-email">Verified email</Label>
                <Input id="operator-email" value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="operator-display-name">Display name</Label>
                <Input
                  id="operator-display-name"
                  name="display_name"
                  value={draft}
                  maxLength={100}
                  required
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              {status ? <p role="status" className="text-xs text-muted-foreground">{status}</p> : null}
              <Button className="w-full" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
