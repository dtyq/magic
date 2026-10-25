import { cn } from "@/utils/cn"
import type { VisualPresetOption } from "../../types"

const PRESET_LAYOUT_MARK_VARIANTS = {
	"code-dispatch": "dispatch",
	"dark-tech": "terminal",
	"film-vintage": "media",
	"gradient-editorial": "editorial",
	"ins-gradient": "media",
	"ins-modern": "frame",
	"ins-minimal": "frame",
	"ins-retro": "media",
	"neo-brutalism": "bold-card",
	"paper-column": "column",
	"personal-insight": "insight",
	"product-launch-preset": "launch",
	"signal-grid": "grid",
	"warm-journal": "journal",
} as const

type PresetLayoutMarkVariant =
	| (typeof PRESET_LAYOUT_MARK_VARIANTS)[keyof typeof PRESET_LAYOUT_MARK_VARIANTS]
	| "custom"
	| "none"
	| "profile"

function extractAccentColor(swatch?: string): string {
	const colors = swatch?.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)/gi) ?? []

	return colors.at(-1) ?? "#18181b"
}

function getPresetLayoutMarkVariant(value: string): PresetLayoutMarkVariant {
	if (value === "custom") return "custom"
	if (value === "none") return "none"

	return PRESET_LAYOUT_MARK_VARIANTS[value as keyof typeof PRESET_LAYOUT_MARK_VARIANTS] ?? "frame"
}

export function PresetLayoutMark({
	className,
	preset,
}: {
	className?: string
	preset: VisualPresetOption
}) {
	const accentColor =
		preset.value === "code-dispatch" ? "#dd0000" : extractAccentColor(preset.swatch)
	const variant = getPresetLayoutMarkVariant(preset.value)
	const isDark = variant === "terminal"
	const lineClass = isDark ? "bg-white/75" : "bg-zinc-950/70"
	const mutedLineClass = isDark ? "bg-white/30" : "bg-zinc-950/18"
	const surfaceClass = isDark
		? "border-zinc-950/80 bg-zinc-950"
		: "border-zinc-950/10 bg-[#fbfbfa]"

	const accentStyle = { backgroundColor: accentColor }

	return (
		<div
			aria-hidden="true"
			className={cn(
				"relative overflow-hidden rounded-xl border p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),0_4px_12px_rgba(24,24,27,0.08)]",
				surfaceClass,
				className,
			)}
			data-layout-mark-variant={variant}
			data-testid={`visual-preset-layout-mark-${preset.value}`}
		>
			<span className="absolute inset-x-0 top-0 h-1" style={accentStyle} />
			{variant === "none" ? (
				<div className="flex h-full items-center justify-center">
					<span className="h-3.5 w-3.5 rounded-full border border-dashed border-zinc-400" />
				</div>
			) : variant === "custom" ? (
				<div className="relative h-full rounded-md border border-zinc-950/70 bg-white">
					<span className="absolute left-1/2 top-1/2 h-2.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-6 rounded-full bg-zinc-950" />
				</div>
			) : variant === "bold-card" ? (
				<div className="relative h-full overflow-hidden rounded-md bg-[#fafaf8]">
					<div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,transparent_6px,#dedbd1_7px)]" />
					<span className="absolute bottom-0 left-[22%] top-0 w-px bg-[#ff2442]/25" />
					<div className="relative z-[1] flex h-full flex-col items-center justify-center gap-0.5 px-1 pb-2 pt-1">
						<span className="h-1.5 w-6 rounded-full bg-zinc-950" />
						<span className="h-1.5 w-5 rounded-full bg-zinc-950" />
						<span className="h-1 w-6 rounded-full bg-[#ffe566]" />
					</div>
					<div className="absolute inset-x-1 bottom-1 z-[1] flex h-1.5 overflow-hidden rounded-[2px] border border-zinc-950">
						<span className="flex-1 bg-[#ffe566]" />
						<span className="flex-1 bg-[#ff2442]" />
					</div>
				</div>
			) : variant === "dispatch" ? (
				<div className="flex h-full flex-col gap-1 pt-1.5">
					<span className="absolute inset-x-0 top-0 h-1 bg-zinc-950" />
					<div className="mt-1 flex items-center gap-1">
						<span className="h-1.5 w-1.5" style={accentStyle} />
						<span className="h-1 w-5 rounded-full bg-zinc-950/75" />
					</div>
					<span className="h-1 w-7 rounded-full bg-zinc-950/25" />
					<span className="h-1 w-4 rounded-full bg-zinc-950/25" />
					<span className="mt-auto h-2.5 rounded border border-zinc-950/25 bg-white" />
				</div>
			) : variant === "editorial" ? (
				<div className="flex h-full flex-col gap-1 pt-1">
					<span className="border-zinc-950/12 h-3.5 rounded border bg-zinc-950/[0.08]" />
					<span className={cn("mt-auto h-1.5 w-7 rounded-full", lineClass)} />
					<span className={cn("h-1 w-5 rounded-full", mutedLineClass)} />
				</div>
			) : variant === "insight" ? (
				<div className="flex h-full flex-col gap-1.5 pt-1">
					<div className="flex items-center gap-1">
						<span className="h-2.5 w-2.5 rounded-full" style={accentStyle} />
						<span className={cn("h-1 w-5 rounded-full", lineClass)} />
					</div>
					<div className="border-zinc-950/14 rounded border bg-white p-1">
						<span className={cn("mb-1 block h-1 w-6 rounded-full", lineClass)} />
						<span className={cn("block h-1 w-4 rounded-full", mutedLineClass)} />
					</div>
				</div>
			) : variant === "grid" ? (
				<div className="grid h-full grid-cols-2 grid-rows-2 gap-px pt-1">
					<span className="rounded-sm border border-zinc-950/45 bg-white" />
					<span className="rounded-sm border border-zinc-950/45 bg-white" />
					<span className="rounded-sm border border-zinc-950/45 bg-white" />
					<span className="rounded-sm border border-zinc-950/45 bg-white" />
				</div>
			) : variant === "terminal" ? (
				<div className="flex h-full flex-col justify-end gap-1 pt-2">
					<span className={cn("h-1.5 w-7 rounded-full", lineClass)} />
					<span className={cn("h-1 w-5 rounded-full", mutedLineClass)} />
					<span className="mt-0.5 h-2.5 w-full rounded border border-white/20" />
				</div>
			) : variant === "media" || variant === "journal" ? (
				<div className="flex h-full flex-col gap-1 pt-1">
					<span className={cn("h-1.5 w-6 rounded-full", lineClass)} />
					<span className={cn("h-1 w-4 rounded-full", mutedLineClass)} />
					<span className="border-zinc-950/18 mt-auto h-3.5 rounded border bg-zinc-950/[0.06]" />
				</div>
			) : variant === "column" ? (
				<div className="flex h-full gap-1 pt-1">
					<span className="bg-zinc-950/18 h-full w-px" />
					<div className="flex flex-1 flex-col gap-1">
						<span className={cn("h-1.5 w-7 rounded-full", lineClass)} />
						<span className={cn("h-1 w-5 rounded-full", mutedLineClass)} />
						<span className="border-zinc-950/18 mt-auto h-3 rounded border bg-zinc-950/[0.04]" />
					</div>
				</div>
			) : variant === "profile" ? (
				<div className="flex h-full flex-col gap-1.5 pt-1">
					<div className="flex items-center gap-1">
						<span className="h-2.5 w-2.5 rounded-full" style={accentStyle} />
						<span className={cn("h-1 w-5 rounded-full", lineClass)} />
					</div>
					<span className={cn("h-1.5 w-7 rounded-full", lineClass)} />
					<span className={cn("h-1 w-5 rounded-full", mutedLineClass)} />
				</div>
			) : variant === "launch" ? (
				<div className="flex h-full flex-col justify-end gap-1 pt-2">
					<span className={cn("h-1.5 w-7 rounded-full", lineClass)} />
					<span className={cn("h-1 w-4 rounded-full", mutedLineClass)} />
					<span className="border-zinc-950/12 h-3 rounded border bg-zinc-950/[0.04]" />
				</div>
			) : (
				<div className="flex h-full flex-col justify-center gap-1">
					<span className={cn("h-1.5 w-7 rounded-full", lineClass)} />
					<span className={cn("h-1 w-5 rounded-full", mutedLineClass)} />
					<span className={cn("h-1 w-6 rounded-full", mutedLineClass)} />
				</div>
			)}
		</div>
	)
}
