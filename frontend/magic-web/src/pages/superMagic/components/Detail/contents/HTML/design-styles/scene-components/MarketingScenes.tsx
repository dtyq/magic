import { useState, type ReactNode } from "react"
import SceneArtwork from "../SceneArtwork"
import type { StyleLayout, StyleScene } from "../styleProfiles"
import { useSceneCopy } from "../useSceneCopy"
import { SceneButton, SceneHeader, SceneSidebar } from "./ScenePrimitives"

interface SceneProps {
	compact: boolean
	narrow: boolean
	layout: StyleLayout
	/** Optional content extracted from the selected DESIGN.md catalog entry. */
	title?: string
	description?: string
}

function WithNavigation({
	children,
	compact,
	narrow,
	layout,
}: SceneProps & { children: ReactNode }) {
	return layout === "sidebar" && !narrow ? (
		<div className="flex min-h-full">
			<SceneSidebar />
			{children}
		</div>
	) : (
		<div className="min-h-full">
			<SceneHeader compact={compact} narrow={narrow} />
			{children}
		</div>
	)
}

export function EditorialScene({
	scene,
	compact,
	narrow,
	layout,
	title: styleTitle,
	description: styleDescription,
}: SceneProps & { scene: StyleScene }) {
	const copy = useSceneCopy()
	const [subscribed, setSubscribed] = useState(false)
	const title = styleTitle || (scene === "portfolio" ? copy.portfolioTitle : copy.editorialTitle)
	const description =
		styleDescription ||
		(scene === "portfolio" ? copy.portfolioDescription : copy.editorialDescription)
	const gridLayout = layout === "grid"
	return (
		<WithNavigation compact={compact} narrow={narrow} layout={layout}>
			<main className={`${compact ? "p-4" : "p-6"} min-w-0 flex-1`}>
				<div
					className={`grid items-center gap-[var(--scene-gap)] ${narrow || layout === "stacked" ? "grid-cols-1" : layout === "magazine" ? "grid-cols-[.8fr_1.2fr]" : gridLayout ? "grid-cols-[1.2fr_.8fr]" : "grid-cols-2"}`}
				>
					<div className={layout === "magazine" && !narrow ? "order-2" : ""}>
						<p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--scene-primary)]">
							{copy.collection} · {copy.readTime}
						</p>
						<h2
							className={`${compact ? "mt-2 text-2xl" : "mt-3 [font-size:var(--scene-title-size)]"} leading-[.98] tracking-[-0.05em] [font-weight:var(--scene-weight)]`}
						>
							{title}
						</h2>
						{!compact && (
							<>
								<p className="mt-4 max-w-lg text-xs leading-6 text-[var(--scene-muted)]">
									{description}
								</p>
								<div className="mt-5 flex gap-2">
									<SceneButton>{copy.explore}</SceneButton>
									<SceneButton secondary>{copy.save}</SceneButton>
								</div>
							</>
						)}
					</div>
					<div
						className={`${compact ? "h-36" : layout === "stacked" && !narrow ? "h-40" : "min-h-64"} overflow-hidden shadow-[var(--scene-shadow)] [border-radius:var(--scene-radius)]`}
					>
						<SceneArtwork
							scene={scene}
							label={copy.illustration}
							variant={layout === "magazine" ? 1 : 0}
						/>
					</div>
				</div>
				{!compact && (
					<div
						className={`mt-[var(--scene-gap)] grid gap-[var(--scene-gap)] border-t border-[var(--scene-line)] pt-[var(--scene-gap)] ${narrow ? "grid-cols-1" : "grid-cols-[1fr_1fr_.7fr]"}`}
					>
						<p className="text-lg font-semibold leading-tight">{title}</p>
						<p className="text-xs leading-6 text-[var(--scene-muted)]">{description}</p>
						<form
							onSubmit={(event) => {
								event.preventDefault()
								setSubscribed(true)
							}}
						>
							<label className="text-[10px] font-semibold">{copy.newsletter}</label>
							<div className="mt-2 flex">
								<input
									type="email"
									aria-label={copy.email}
									className="min-w-0 flex-1 border border-[var(--scene-line)] bg-transparent px-2 text-[10px] outline-none focus:border-[var(--scene-primary)]"
									placeholder={copy.email}
								/>
								<button
									type="submit"
									className="bg-[var(--scene-primary)] px-3 py-2 text-[10px] font-semibold text-[var(--scene-on-primary)]"
								>
									{subscribed ? copy.subscribed : copy.subscribe}
								</button>
							</div>
						</form>
					</div>
				)}
			</main>
		</WithNavigation>
	)
}

export function CommerceScene({
	compact,
	narrow,
	layout,
	title: styleTitle,
	description: styleDescription,
}: SceneProps) {
	const copy = useSceneCopy()
	const [saved, setSaved] = useState(false)
	const centered = layout === "centered"
	const title = styleTitle || copy.commerceTitle
	const description = styleDescription || copy.commerceDescription
	return (
		<WithNavigation compact={compact} narrow={narrow} layout={layout}>
			<main className={`${compact ? "p-4" : "p-6"} min-w-0 flex-1`}>
				<div
					className={`grid items-center gap-[var(--scene-gap)] ${narrow || layout === "stacked" || centered ? "grid-cols-1" : "grid-cols-[1.05fr_.95fr]"} ${centered ? "text-center" : ""}`}
				>
					<div className={centered ? "mx-auto" : ""}>
						<p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--scene-primary)]">
							{copy.collection}
						</p>
						<h2
							className={`${compact ? "mt-2 text-2xl" : "mt-3 [font-size:var(--scene-title-size)]"} max-w-[13ch] leading-[.98] tracking-[-0.05em] [font-weight:var(--scene-weight)]`}
						>
							{title}
						</h2>
						{!compact && (
							<>
								<p className="mt-4 max-w-md text-xs leading-6 text-[var(--scene-muted)]">
									{description}
								</p>
								<div
									className={`mt-5 flex gap-2 ${centered ? "justify-center" : ""}`}
								>
									<SceneButton>{copy.explore}</SceneButton>
									<SceneButton
										secondary
										onClick={() => setSaved((value) => !value)}
									>
										{saved ? copy.saved : copy.save}
									</SceneButton>
								</div>
							</>
						)}
					</div>
					<div
						className={`${compact ? "h-40" : layout === "stacked" && !narrow ? "h-40" : "min-h-72"} overflow-hidden shadow-[var(--scene-shadow)] [border-radius:var(--scene-radius)]`}
					>
						<SceneArtwork
							scene="commerce"
							label={copy.illustration}
							variant={layout === "grid" ? 1 : 0}
						/>
					</div>
				</div>
				{!compact && (
					<div
						className={`mt-[var(--scene-gap)] grid gap-3 ${narrow ? "grid-cols-1" : "grid-cols-3"}`}
					>
						{copy.projectNames.map((name, index) => (
							<article
								key={name}
								className="border-t border-[var(--scene-line)] pt-3"
							>
								<div className="mb-3 h-20 overflow-hidden bg-[var(--scene-surface)]">
									<SceneArtwork
										scene="commerce"
										label={copy.illustration}
										variant={index}
									/>
								</div>
								<div className="flex items-center justify-between gap-2 text-[11px]">
									<span>{name}</span>
									<strong className="tabular-nums">
										¥{[680, 920, 1280][index]}
									</strong>
								</div>
							</article>
						))}
					</div>
				)}
			</main>
		</WithNavigation>
	)
}

export function LandingScene({
	scene,
	compact,
	narrow,
	layout,
	title: styleTitle,
	description: styleDescription,
}: SceneProps & { scene: StyleScene }) {
	const copy = useSceneCopy()
	const title = styleTitle || (scene === "terminal" ? copy.terminalTitle : copy.landingTitle)
	const description =
		styleDescription ||
		(scene === "terminal" ? copy.terminalDescription : copy.landingDescription)
	const centered = layout === "centered"
	const reverse = layout === "magazine"
	return (
		<WithNavigation compact={compact} narrow={narrow} layout={layout}>
			<main className={`${compact ? "p-4" : "p-6"} min-w-0 flex-1`}>
				<div
					className={`grid items-center gap-[var(--scene-gap)] ${narrow || layout === "stacked" || centered ? "grid-cols-1 text-center" : layout === "grid" ? "grid-cols-[.8fr_1.2fr]" : "grid-cols-[1.05fr_.95fr]"}`}
				>
					<div
						className={`${centered ? "mx-auto max-w-xl" : ""} ${reverse && !narrow ? "order-2" : ""}`}
					>
						<p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--scene-primary)]">
							{copy.latest}
						</p>
						<h2
							className={`${compact ? "mt-2 text-2xl" : "mt-3 [font-size:var(--scene-title-size)]"} leading-[.94] tracking-[-0.055em] [font-weight:var(--scene-weight)]`}
						>
							{title}
						</h2>
						{!compact && (
							<>
								<p
									className={`mt-4 text-xs leading-6 text-[var(--scene-muted)] ${centered ? "mx-auto max-w-lg" : "max-w-md"}`}
								>
									{description}
								</p>
								<div
									className={`mt-5 flex gap-2 ${centered || narrow ? "justify-center" : ""}`}
								>
									<SceneButton>{copy.explore}</SceneButton>
									<SceneButton secondary>{copy.projects}</SceneButton>
								</div>
							</>
						)}
					</div>
					{!centered && (
						<div
							className={`${compact ? "h-36" : layout === "stacked" && !narrow ? "h-40" : "min-h-64"} overflow-hidden shadow-[var(--scene-shadow)] [border-radius:var(--scene-radius)]`}
						>
							<SceneArtwork
								scene={scene}
								label={copy.illustration}
								variant={layout === "grid" ? 2 : 1}
							/>
						</div>
					)}
				</div>
				{!compact && (
					<div
						className={`mt-[var(--scene-gap)] grid gap-3 ${narrow ? "grid-cols-1" : "grid-cols-3"}`}
					>
						{copy.metrics.map((label, index) => (
							<div key={label} className="border-t border-[var(--scene-line)] pt-3">
								<div className="text-xl font-semibold tabular-nums">
									{["128K", "42", "99.9%"][index]}
								</div>
								<div className="mt-1 text-[10px] text-[var(--scene-muted)]">
									{label}
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</WithNavigation>
	)
}
