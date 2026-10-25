import type { ReactNode } from "react"
import { useSceneCopy } from "../useSceneCopy"

function Logo({ label }: { label: string }) {
	return (
		<div className="flex min-w-0 items-center gap-2 font-semibold tracking-[-0.02em]">
			<span className="flex size-7 shrink-0 items-center justify-center bg-[var(--scene-primary)] text-[10px] font-bold text-[var(--scene-on-primary)] [border-radius:var(--scene-radius)]">
				M
			</span>
			<span className="truncate">{label}</span>
		</div>
	)
}

export function SceneButton({
	children,
	secondary = false,
	onClick,
}: {
	children: ReactNode
	secondary?: boolean
	onClick?: () => void
}) {
	return (
		<button
			type="button"
			className={`min-h-8 whitespace-nowrap px-3 py-1.5 text-[11px] font-semibold transition-[transform,opacity] [border-radius:var(--scene-radius)] active:scale-[0.96] ${secondary ? "border border-[var(--scene-line)] bg-[var(--scene-surface)] text-[var(--scene-ink)] hover:opacity-70" : "bg-[var(--scene-primary)] text-[var(--scene-on-primary)] hover:opacity-90"}`}
			onClick={onClick}
		>
			{children}
		</button>
	)
}

export function SceneHeader({ compact, narrow = false }: { compact: boolean; narrow?: boolean }) {
	const copy = useSceneCopy()
	return (
		<header
			className={`flex items-center justify-between border-b border-[var(--scene-line)] ${compact ? "px-4 py-3 text-[11px]" : "px-6 py-4 text-xs"}`}
		>
			<Logo label={copy.brand} />
			{narrow ? (
				<span
					className="text-[12px] tracking-[0.18em] text-[var(--scene-muted)]"
					aria-hidden="true"
				>
					•••
				</span>
			) : (
				<nav
					className="flex items-center gap-5 text-[10px] text-[var(--scene-muted)]"
					aria-label={copy.navigation}
					aria-hidden="true"
				>
					<span>{copy.overview}</span>
					<span>{copy.projects}</span>
					<span>{copy.activity}</span>
				</nav>
			)}
		</header>
	)
}

export function SceneSidebar({ active = 0 }: { active?: number }) {
	const copy = useSceneCopy()
	return (
		<aside className="w-40 shrink-0 border-r border-[var(--scene-line)] p-4">
			<Logo label={copy.brand} />
			<nav className="mt-7 space-y-1.5" aria-label={copy.navigation} aria-hidden="true">
				{[copy.overview, copy.projects, copy.activity, copy.settings].map(
					(label, index) => (
						<div
							key={label}
							className={`px-2.5 py-2 text-[10px] [border-radius:var(--scene-radius)] ${active === index ? "bg-[var(--scene-primary)] text-[var(--scene-on-primary)]" : "text-[var(--scene-muted)]"}`}
						>
							{label}
						</div>
					),
				)}
			</nav>
		</aside>
	)
}
