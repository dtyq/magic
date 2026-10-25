/**
 * Heading of a research home section, with an optional quiet hint beside it. The row wraps so that
 * on narrow screens the hint drops below the title instead of squeezing it.
 */
export default function SectionTitle({ title, hint }: { title: string; hint?: string }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
			<h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
			{hint ? <span className="text-[13px] text-muted-foreground">{hint}</span> : null}
		</div>
	)
}
