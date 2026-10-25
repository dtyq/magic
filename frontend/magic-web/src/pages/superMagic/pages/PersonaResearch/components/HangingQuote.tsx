import { cn } from "@/utils/cn"

interface HangingQuoteProps {
	text: string
	/** Line clamp for the text (e.g. "line-clamp-3"); the opening mark is never clipped by it. */
	clampClassName?: string
	className?: string
}

/**
 * Quote set like a print pull quote: the opening mark hangs in the left padding so every line
 * of text starts on the same edge. The mark sits outside the clamped box, because line-clamp's
 * overflow hidden would otherwise cut it off.
 */
export default function HangingQuote({ text, clampClassName, className }: HangingQuoteProps) {
	return (
		<span className={cn("relative block pl-[0.55em]", className)}>
			<span aria-hidden className="absolute left-0 top-0 -translate-x-[0.1em]">
				“
			</span>
			<span className={cn("block", clampClassName)}>{text}”</span>
		</span>
	)
}
