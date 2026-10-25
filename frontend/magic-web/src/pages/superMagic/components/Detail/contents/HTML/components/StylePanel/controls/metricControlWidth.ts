export const METRIC_CONTROL_MAX_WIDTH = 220
/** Match NumericDragInput stepper chevrons in compact toolbar fields. */
export const METRIC_SELECT_TRIGGER_CLASS =
	"h-full w-3.5 shrink-0 rounded-none border-y-0 border-r-0 border-l border-border/60 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-primary/10 hover:text-primary disabled:opacity-50 [&>span]:hidden [&_svg]:!size-2.5 [&_svg]:!opacity-100"
const METRIC_INPUT_MIN_WIDTH = 48
const METRIC_INPUT_MAX_WIDTH = 164
const METRIC_STEPPER_WIDTH = 14

/** Keep short values compact while reserving enough room for longer CSS values. */
export function getMetricControlWidth(value: string): number {
	return Math.min(
		METRIC_CONTROL_MAX_WIDTH,
		getMetricInputWidth(value) + 56 + METRIC_STEPPER_WIDTH,
	)
}

export function getMetricInputWidth(value: string): number {
	return Math.min(
		METRIC_INPUT_MAX_WIDTH,
		Math.max(METRIC_INPUT_MIN_WIDTH, 28 + Math.max(value.length, 1) * 8),
	)
}
