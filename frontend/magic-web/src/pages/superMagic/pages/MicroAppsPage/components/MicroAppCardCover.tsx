import { useState } from "react"
import { Blocks, Box, Component, Layers3, Shapes } from "lucide-react"
import { cn } from "@/utils/cn"

const themes = [
	"text-violet-600 dark:text-violet-300",
	"text-sky-600 dark:text-sky-300",
	"text-teal-600 dark:text-teal-300",
	"text-orange-600 dark:text-orange-300",
	"text-rose-600 dark:text-rose-300",
] as const

const icons = [Layers3, Blocks, Component, Box, Shapes]

function resolveThemeIndex(seed: string) {
	let hash = 0
	for (let index = 0; index < seed.length; index += 1) {
		hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
	}
	return hash % themes.length
}

export default function MicroAppCardCover({
	id,
	coverUrl,
	compact = false,
	variant = "cover",
}: {
	id: string
	coverUrl?: string
	compact?: boolean
	variant?: "cover" | "icon"
}) {
	const [failedUrl, setFailedUrl] = useState<string>()
	const hasCover = Boolean(coverUrl && failedUrl !== coverUrl)
	const themeIndex = resolveThemeIndex(id)
	const Icon = icons[themeIndex]
	const icon = variant === "icon"

	return (
		<div
			aria-hidden
			data-cover={hasCover ? "image" : "placeholder"}
			className={cn(
				"relative isolate shrink-0 overflow-hidden bg-[color-mix(in_srgb,currentColor_13%,rgb(var(--card-rgb)))]",
				themes[themeIndex],
				icon
					? "size-8 rounded-lg"
					: compact
						? "h-14 w-[76px] rounded-xl"
						: "h-[76px] w-full rounded-xl",
			)}
		>
			{hasCover ? (
				<img
					src={coverUrl}
					alt=""
					loading="lazy"
					decoding="async"
					className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
					onError={() => setFailedUrl(coverUrl)}
				/>
			) : (
				<>
					{/* Texture stays at the edge so compact icons retain a clear silhouette. */}
					<div
						data-cover-texture
						className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(currentColor_0.6px,transparent_0.6px)] opacity-[0.08] transition-opacity duration-300 [background-size:8px_8px] [mask-image:linear-gradient(to_left,black,transparent)] group-hover:opacity-[0.14] motion-reduce:transition-none"
					/>
					{/* Small thumbnails keep a single focal point; decoration only fits wide covers. */}
					{!compact && !icon ? (
						<div
							aria-hidden
							data-cover-decoration
							className="absolute -bottom-[30px] -right-5 size-[76px] rotate-[25deg] rounded-3xl bg-current opacity-[0.08] transition-transform duration-500 ease-out group-hover:-translate-x-2 group-hover:rotate-[18deg] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:rotate-[25deg]"
						/>
					) : null}
					<div
						className={cn(
							"absolute top-1/2 -translate-y-1/2",
							compact || icon ? "left-1/2 -translate-x-1/2" : "left-6",
						)}
					>
						<div
							data-cover-icon
							className={cn(
								"relative flex items-center justify-center rounded-full bg-card transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:rotate-[-4deg] motion-reduce:transform-none motion-reduce:transition-none",
								icon ? "size-6" : compact ? "size-8" : "size-10",
							)}
						>
							<Icon className="size-4" strokeWidth={1.5} />
						</div>
					</div>
				</>
			)}
			<div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5 dark:ring-white/10" />
		</div>
	)
}
