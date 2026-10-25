import type { ReactNode } from "react"
import type { DesignStyle } from "./catalog"
import type { StyleLayout, StyleScene } from "./styleProfiles"
import { getStyleProfile } from "./styleProfiles"
import { useSceneCopy } from "./useSceneCopy"
import DashboardScene from "./scene-components/DashboardScene"
import { CommerceScene, EditorialScene, LandingScene } from "./scene-components/MarketingScenes"

interface DesignStyleLandingPageProps {
	style: DesignStyle
	viewport: "desktop" | "tablet" | "mobile"
	compact?: boolean
}

/**
 * Converts the catalog layout (which describes the page family) to the more
 * granular profile layout used by the existing page templates. `poster` keeps
 * the profile's composition because poster styles intentionally vary between
 * split, centered, and magazine compositions.
 */
function resolveLayout(style: DesignStyle): StyleLayout {
	const profile = getStyleProfile(style.code)
	const catalogLayout = style.preview?.layout
	if (catalogLayout === "dashboard") return "sidebar"
	if (catalogLayout === "editorial") return "magazine"
	if (catalogLayout === "commerce") return "grid"
	return profile?.layout ?? "split"
}

function resolveScene(style: DesignStyle): StyleScene {
	const profile = getStyleProfile(style.code)
	return profile?.scene ?? (style.preview?.layout === "commerce" ? "commerce" : "landing")
}

function previewText(value: string, limit = 240) {
	const normalized = value.replace(/\s+/g, " ").trim()
	return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function SpecRail({ style, compact }: { style: DesignStyle; compact: boolean }) {
	const copy = useSceneCopy()
	if (compact) return null

	const sections = Object.entries(style.design.sections)
		.slice(0, 3)
		.map(([name, description]) => [previewText(name, 72), previewText(description)] as const)
	const components = style.design.components.slice(0, 6)
	return (
		<section
			className="border-t border-[var(--scene-line)] px-6 py-5 [container-type:inline-size]"
			data-testid="design-style-spec-rail"
			aria-label={copy.latest}
		>
			<div className="grid gap-4 [@container(min-width:560px)]:grid-cols-[1.2fr_.8fr]">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--scene-primary)]">
						<span
							className="size-1.5 rounded-full bg-[var(--scene-primary)]"
							aria-hidden="true"
						/>
						{copy.collection}
					</div>
					<p className="mb-3 max-w-[62ch] text-[10px] leading-4 text-[var(--scene-muted)]">
						{previewText(style.description, 180)}
					</p>
					<div className="grid gap-2 [@container(min-width:420px)]:grid-cols-3">
						{sections.map(([name, description], index) => (
							<article
								key={`${name}-${index}`}
								className="min-w-0 border border-[var(--scene-line)] bg-[var(--scene-surface)] p-3 [border-radius:var(--scene-radius)]"
							>
								<h3 className="truncate text-[10px] font-semibold">{name}</h3>
								<p className="mt-2 line-clamp-3 text-[10px] leading-4 text-[var(--scene-muted)]">
									{description}
								</p>
							</article>
						))}
					</div>
				</div>
				<div className="min-w-0 border-l border-[var(--scene-line)] pl-4 [@container(max-width:559px)]:border-l-0 [@container(max-width:559px)]:pl-0">
					<div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--scene-muted)]">
						{copy.components}
					</div>
					<div className="mt-3 flex flex-wrap gap-1.5">
						{(components.length
							? components
							: [style.category, ...style.tags.slice(0, 5)]
						).map((component, index) => (
							<span
								key={`${component}-${index}`}
								className="border border-[var(--scene-line)] px-2 py-1 text-[9px] text-[var(--scene-muted)] [border-radius:var(--scene-radius)]"
							>
								{component}
							</span>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}

function SceneRenderer({
	scene,
	compact,
	narrow,
	layout,
	title,
	description,
}: {
	scene: StyleScene
	compact: boolean
	narrow: boolean
	layout: StyleLayout
	title: string
	description: string
}): ReactNode {
	if (scene === "dashboard")
		return (
			<DashboardScene
				compact={compact}
				narrow={narrow}
				layout={layout}
				title={title}
				description={description}
			/>
		)
	if (scene === "commerce")
		return (
			<CommerceScene
				compact={compact}
				narrow={narrow}
				layout={layout}
				title={title}
				description={description}
			/>
		)
	if (scene === "editorial" || scene === "portfolio") {
		return (
			<EditorialScene
				scene={scene}
				compact={compact}
				narrow={narrow}
				layout={layout}
				title={title}
				description={description}
			/>
		)
	}
	return (
		<LandingScene
			scene={scene}
			compact={compact}
			narrow={narrow}
			layout={layout}
			title={title}
			description={description}
		/>
	)
}

/** A safe React renderer for catalog data; DESIGN.md text is rendered as text nodes only. */
export default function DesignStyleLandingPage({
	style,
	viewport,
	compact = false,
}: DesignStyleLandingPageProps) {
	const profile = getStyleProfile(style.code)
	const scene = resolveScene(style)
	const layout = resolveLayout(style)
	const narrow = viewport === "mobile"
	return (
		<div
			data-testid="design-style-landing-page"
			data-preview-layout={style.preview?.layout ?? "poster"}
			data-page-scene={scene}
			data-page-layout={layout}
			className="min-h-full"
		>
			<SceneRenderer
				scene={scene}
				compact={compact}
				narrow={narrow}
				layout={layout}
				title={style.title}
				description={style.description}
			/>
			<SpecRail style={style} compact={compact} />
			{!compact && profile?.sourceSection ? (
				<div className="px-6 pb-4 text-[9px] text-[var(--scene-muted)]">
					{profile.sourceSection}
				</div>
			) : null}
		</div>
	)
}

export { resolveLayout, resolveScene }
