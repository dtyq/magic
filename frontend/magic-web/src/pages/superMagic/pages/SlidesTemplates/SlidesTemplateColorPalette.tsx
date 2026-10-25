import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { normalizeTemplateColors } from "./templateColors"

interface SlidesTemplateColorPaletteProps {
	className?: string
	colors?: string[]
	compact?: boolean
	onClick?: () => void
	tabIndex?: number
}

export default function SlidesTemplateColorPalette({
	className,
	colors,
	compact = false,
	onClick,
	tabIndex,
}: SlidesTemplateColorPaletteProps) {
	const { t } = useTranslation("crew/create")
	const normalizedColors = normalizeTemplateColors(colors)
	if (normalizedColors.length === 0) return null

	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onClick?.()
	}

	const paletteClassName = cn(
		"inline-flex w-fit items-center gap-1 rounded-full border border-white/[0.14] bg-black/[0.34] p-1 shadow-sm backdrop-blur-md",
		onClick
			? "pointer-events-auto cursor-pointer outline-none transition-[background-color,border-color,transform] hover:scale-[1.03] hover:border-white/[0.28] hover:bg-black/[0.48] focus-visible:ring-2 focus-visible:ring-white/60"
			: "pointer-events-none",
		className,
	)
	const swatches = (
		<>
			{normalizedColors.map((color, index) => (
				<span
					key={color}
					className={cn(
						"block shrink-0 rounded-full border border-white/30 shadow-[0_1px_3px_rgba(0,0,0,0.24)]",
						index === 0
							? compact
								? "size-3.5"
								: "size-4"
							: compact
								? "size-2.5"
								: "size-3",
					)}
					style={{ backgroundColor: color }}
					title={color}
				/>
			))}
		</>
	)

	if (onClick) {
		return (
			<button
				type="button"
				className={paletteClassName}
				aria-label={t("playbook.edit.presets.form.similarColors")}
				onClick={handleClick}
				tabIndex={tabIndex}
				data-testid="slides-template-color-palette"
			>
				{swatches}
			</button>
		)
	}

	return (
		<div
			className={paletteClassName}
			aria-label={t("playbook.edit.presets.form.colorPalette")}
			data-testid="slides-template-color-palette"
		>
			{swatches}
		</div>
	)
}
