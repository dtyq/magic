import { useState } from "react"
import type { StyleLayout } from "../styleProfiles"
import { useSceneCopy } from "../useSceneCopy"
import SceneArtwork from "../SceneArtwork"
import { SceneButton, SceneHeader, SceneSidebar } from "./ScenePrimitives"

interface DashboardSceneProps {
	compact: boolean
	narrow: boolean
	layout: StyleLayout
	/** Optional content extracted from the selected DESIGN.md catalog entry. */
	title?: string
	description?: string
}

export default function DashboardScene({
	compact,
	narrow,
	layout,
	title: styleTitle,
	description: styleDescription,
}: DashboardSceneProps) {
	const copy = useSceneCopy()
	const [activeTab, setActiveTab] = useState(0)
	const [ascending, setAscending] = useState(false)
	const rows = copy.projectNames.map((name, index) => ({ name, value: [64, 82, 47][index] }))
	const centered = layout === "centered"
	const title = styleTitle || copy.dashboardTitle
	const description = styleDescription || copy.dashboardDescription
	const content = (
		<div className={`${compact ? "p-4" : "p-6"} min-w-0 flex-1`}>
			<div
				className={`flex justify-between gap-4 ${narrow ? "flex-col items-start" : "items-end"} ${centered ? "text-center" : ""}`}
			>
				<div className={centered ? "mx-auto" : ""}>
					<p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--scene-primary)]">
						{copy.latest}
					</p>
					<h2
						className={`${compact ? "mt-1 text-xl" : "mt-2 text-3xl"} max-w-[18ch] leading-[1.02] tracking-[-0.045em] [font-weight:var(--scene-weight)]`}
					>
						{title}
					</h2>
				</div>
				{!compact && !centered && <SceneButton>{copy.explore}</SceneButton>}
			</div>
			{!compact && (
				<p
					className={`mt-3 max-w-xl text-xs leading-5 text-[var(--scene-muted)] ${centered ? "mx-auto text-center" : ""}`}
				>
					{description}
				</p>
			)}
			<div
				className={`mt-[var(--scene-gap)] grid gap-3 ${narrow ? "grid-cols-1" : "grid-cols-3"}`}
			>
				{copy.metrics.map((label, index) => (
					<div
						key={label}
						className="border border-[var(--scene-line)] bg-[var(--scene-surface)] p-3 shadow-[var(--scene-shadow)] [border-radius:var(--scene-radius)]"
					>
						<div className="text-[9px] text-[var(--scene-muted)]">{label}</div>
						<div
							className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} font-semibold tabular-nums`}
						>
							{["24.8K", "86.4%", "+32%"][index]}
						</div>
						<div className="mt-2 h-1 overflow-hidden bg-[var(--scene-line)]">
							<div
								className="h-full bg-[var(--scene-primary)]"
								style={{ width: `${62 + index * 12}%` }}
							/>
						</div>
					</div>
				))}
			</div>
			{!compact && (
				<div
					className={`mt-3 grid gap-3 ${narrow ? "grid-cols-1" : "grid-cols-[1.4fr_.6fr]"}`}
				>
					<section className="border border-[var(--scene-line)] bg-[var(--scene-surface)] p-4 shadow-[var(--scene-shadow)] [border-radius:var(--scene-radius)]">
						<div className="mb-4 flex items-center justify-between gap-3">
							<div className="flex gap-1">
								{[copy.all, copy.active].map((label, index) => (
									<button
										type="button"
										key={label}
										onClick={() => setActiveTab(index)}
										className={`px-2.5 py-1 text-[10px] [border-radius:var(--scene-radius)] ${activeTab === index ? "bg-[var(--scene-primary)] text-[var(--scene-on-primary)]" : "text-[var(--scene-muted)]"}`}
									>
										{label}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={() => setAscending((value) => !value)}
								className="text-[10px] text-[var(--scene-primary)]"
							>
								{copy.sort} {ascending ? "↑" : "↓"}
							</button>
						</div>
						<div className="grid grid-cols-[1fr_80px_1fr] border-b border-[var(--scene-line)] pb-2 text-[9px] uppercase tracking-wider text-[var(--scene-muted)]">
							<span>{copy.name}</span>
							<span>{copy.status}</span>
							<span>{copy.progress}</span>
						</div>
						{[...rows]
							.sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))
							.map((row) => (
								<div
									key={row.name}
									className="grid grid-cols-[1fr_80px_1fr] items-center border-b border-[var(--scene-line)] py-3 text-[10px] last:border-0"
								>
									<span>{row.name}</span>
									<span className="text-[var(--scene-muted)]">{copy.active}</span>
									<span className="flex items-center gap-2">
										<span className="h-1 flex-1 bg-[var(--scene-line)]">
											<span
												className="block h-full bg-[var(--scene-primary)]"
												style={{ width: `${row.value}%` }}
											/>
										</span>
										<span className="tabular-nums">{row.value}%</span>
									</span>
								</div>
							))}
					</section>
					<div className="overflow-hidden [border-radius:var(--scene-radius)]">
						<SceneArtwork scene="dashboard" label={copy.chart} variant={2} />
					</div>
				</div>
			)}
		</div>
	)

	return layout === "sidebar" && !narrow ? (
		<div className="flex min-h-full">
			<SceneSidebar />
			{content}
		</div>
	) : (
		<>
			<SceneHeader compact={compact} narrow={narrow} />
			{content}
		</>
	)
}
