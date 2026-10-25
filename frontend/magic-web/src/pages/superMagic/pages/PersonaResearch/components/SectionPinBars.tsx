import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/utils/cn"
import { SECTION_PIN_HEIGHT, type SectionPin, type SectionPosition } from "../hooks/useSectionPins"

interface SectionPinBarsProps {
	sections: SectionPin[]
	positions: Record<string, SectionPosition>
	onJump: (id: string) => void
}

/**
 * Section headings stuck to the edges of a long page: those scrolled past stack at the top, those
 * not reached yet at the bottom, and a tap jumps to the section. Sits over the scroller, so it
 * needs a positioned parent.
 */
export default function SectionPinBars({ sections, positions, onJump }: SectionPinBarsProps) {
	const above = sections.filter((section) => positions[section.id] === "above")
	const below = sections.filter((section) => positions[section.id] === "below")

	const renderBar = (section: SectionPin, edge: "top" | "bottom") => (
		<button
			key={section.id}
			type="button"
			className={cn(
				"pointer-events-auto flex w-full items-center gap-2 bg-background/95 px-4 text-left outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				edge === "top" ? "border-b border-border" : "border-t border-border",
			)}
			style={{ height: SECTION_PIN_HEIGHT }}
			data-testid={`persona-research-pin-${section.id}`}
			onClick={() => onJump(section.id)}
		>
			<span className="truncate text-sm font-bold text-foreground">{section.title}</span>
			{section.hint ? (
				<span className="shrink-0 text-xs text-muted-foreground">{section.hint}</span>
			) : null}
			{edge === "top" ? (
				<ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" />
			) : (
				<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
			)}
		</button>
	)

	return (
		<>
			{above.length > 0 ? (
				<div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col">
					{above.map((section) => renderBar(section, "top"))}
				</div>
			) : null}
			{below.length > 0 ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col bg-background/95 pb-[env(safe-area-inset-bottom)]">
					{below.map((section) => renderBar(section, "bottom"))}
				</div>
			) : null}
		</>
	)
}
