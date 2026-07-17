import * as React from 'react';
import { ActivityIcon, BellIcon, ClipboardListIcon, DatabaseIcon, MapIcon, MenuIcon, ScrollTextIcon, UserRoundIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const NAV = [
	{ href: '/', label: 'Monitor', icon: MapIcon },
	{ href: '/forecasts', label: 'Forecast list', icon: ClipboardListIcon },
	{ href: '/logs', label: 'Logs', icon: ScrollTextIcon },
	{ href: '', label: 'Alerts', icon: BellIcon, disabled: true },
	{ href: '/events', label: 'Raw events', icon: DatabaseIcon },
] as const;

function Navigation({ activePath, onNavigate }: { activePath: string; onNavigate?: () => void }) {
	return (
		<nav aria-label="Portal navigation" className="flex flex-col gap-1 p-2">
			{NAV.map((item) => { const { href, label, icon: Icon } = item; return 'disabled' in item && item.disabled ? (
				<span key={label} aria-disabled="true" title={`${label} — coming soon`} className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground opacity-50 md:justify-center md:px-0"><Icon /><span className="md:sr-only">{label} — coming soon</span></span>
			) : (
				<a key={href} href={href} onClick={onNavigate} title={label} aria-current={activePath === href ? 'page' : undefined} className={cn('flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-sidebar-accent md:justify-center md:px-0', activePath === href && 'bg-primary text-primary-foreground hover:bg-primary')}><Icon /><span className="md:sr-only">{label}</span></a>
			); })}
		</nav>
	);
}

function OperatorProfile({ email, initialName }: { email: string; initialName: string }) {
	const [open, setOpen] = React.useState(false);
	const [displayName, setDisplayName] = React.useState(initialName);
	const [draft, setDraft] = React.useState(initialName);
	const [status, setStatus] = React.useState('');
	const [saving, setSaving] = React.useState(false);

	async function save(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault(); setSaving(true); setStatus('');
		const response = await fetch('/api/operator-profile', { method: 'POST', body: new FormData(event.currentTarget) });
		const data = await response.json() as { display_name?: string; error?: string };
		if (response.ok && data.display_name) { setDisplayName(data.display_name); setDraft(data.display_name); setStatus('Profile saved.'); }
		else setStatus(data.error ?? 'Could not save profile.');
		setSaving(false);
	}

	return (
		<div className="relative">
			<Button variant="outline" className="rounded-full bg-background" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}><UserRoundIcon /><span className="hidden sm:inline">{displayName || 'Operator profile'}</span></Button>
			{open ? <div role="dialog" aria-label="Operator profile" className="absolute right-0 top-12 z-50 w-[min(90vw,24rem)] rounded-xl border bg-popover p-4 shadow-xl">
				<div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Operator profile</p><h2 className="font-semibold">PHIVOLCS account details</h2></div><Button variant="ghost" size="icon" aria-label="Close profile" onClick={() => setOpen(false)}><XIcon /></Button></div>
				<form className="space-y-4" onSubmit={save}>
					<div className="space-y-1.5"><Label htmlFor="operator-email">Verified email</Label><Input id="operator-email" value={email} disabled /></div>
					<div className="space-y-1.5"><Label htmlFor="operator-display-name">Display name</Label><Input id="operator-display-name" name="display_name" value={draft} maxLength={100} required onChange={(event) => setDraft(event.target.value)} /></div>
					{status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
					<Button className="w-full" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
				</form>
			</div> : null}
		</div>
	);
}

export function PortalShell({ activePath, operatorEmail, operatorDisplayName, children }: { activePath: string; operatorEmail: string; operatorDisplayName: string; children: React.ReactNode }) {
	const [mobileNav, setMobileNav] = React.useState(false);
	return (
		<div className="flex min-h-svh bg-background">
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col border-r bg-sidebar md:flex">
				<a href="/" title="PHIVOLCS monitor" className="m-2 grid size-12 place-items-center rounded-xl bg-primary font-black text-primary-foreground">QS</a>
				<Navigation activePath={activePath} />
				<div className="mt-auto grid place-items-center p-3 text-primary" title="Systems monitored"><ActivityIcon /></div>
			</aside>
			{mobileNav ? <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileNav(false)}><aside className="h-full w-72 bg-sidebar p-2" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between p-2"><strong>PHIVOLCS platform</strong><Button size="icon" variant="ghost" onClick={() => setMobileNav(false)}><XIcon /></Button></div><Navigation activePath={activePath} onNavigate={() => setMobileNav(false)} /></aside></div> : null}
		<div className="flex min-h-svh min-w-0 flex-1 flex-col md:ml-16">
			<header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur">
				<div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><MenuIcon /></Button><div className="min-w-0"><strong className="block truncate text-sm">QuakeStrike PH</strong><span className="block truncate text-xs text-muted-foreground">PHIVOLCS Monitoring Platform</span></div></div>
				<OperatorProfile email={operatorEmail} initialName={operatorDisplayName} />
			</header>
			{children}
		</div>
		</div>
	);
}
