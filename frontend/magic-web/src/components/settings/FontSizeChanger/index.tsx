import { Slider } from "@/components/shadcn-ui/slider"
import { useFontScale } from "@/models/config/hooks"
import { useDebounceFn } from "ahooks"
import { useState, useEffect } from "react"

function FontSizeChanger() {
	const { fontScale, setFontScale } = useFontScale()

	// Keep dragging responsive while persistence to the global settings is debounced.
	const [localFontScale, setLocalFontScale] = useState(fontScale)

	// Reflect font scale changes made outside this control.
	useEffect(() => {
		setLocalFontScale(fontScale)
	}, [fontScale])

	const { run: debouncedSetFontScale } = useDebounceFn(
		(newValue: number) => {
			setFontScale(newValue)
		},
		{ wait: 300 },
	)

	// Convert the slider's single-thumb array into the numeric font scale.
	const onSliderChange = (value: number[]) => {
		const numValue = value[0]
		// Update the displayed value immediately.
		setLocalFontScale(numValue)
		// Persist the global value after dragging pauses.
		debouncedSetFontScale(numValue)
	}

	return (
		<div className="flex w-full items-center gap-3.5">
			<Slider
				value={[localFontScale]}
				onValueChange={onSliderChange}
				min={0.8}
				max={1.2}
				step={0.01}
				className="flex-1"
			/>
			<div className="flex h-9 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-input bg-background px-3 py-1 shadow-xs">
				<div className="overflow-hidden overflow-ellipsis text-sm leading-5 text-foreground">
					{((localFontScale ?? 1.0) * 100).toFixed(0)}%
				</div>
			</div>
		</div>
	)
}

export default FontSizeChanger
