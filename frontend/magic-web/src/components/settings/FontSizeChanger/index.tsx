import { Slider } from "@/components/shadcn-ui/slider"
import { useFontScale } from "@/models/config/hooks"
import { useDebounceFn } from "ahooks"
import { useState, useEffect } from "react"

function FontSizeChanger() {
	const { fontScale, setFontScale } = useFontScale()

	// 本地状态用于实时显示，避免拖动卡顿
	const [localFontScale, setLocalFontScale] = useState(fontScale)

	// 当外部 fontScale 变化时，同步本地状态
	useEffect(() => {
		setLocalFontScale(fontScale)
	}, [fontScale])

	const { run: debouncedSetFontScale } = useDebounceFn(
		(newValue: number) => {
			setFontScale(newValue)
		},
		{ wait: 300 },
	)

	// Slider 组件的 onChange 处理
	const onSliderChange = (value: number[]) => {
		const numValue = value[0]
		// 立即更新本地状态，提供实时反馈
		setLocalFontScale(numValue)
		// 防抖更新全局状态
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
			<div className="flex h-9 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-input bg-white px-3 py-1 shadow-xs">
				<div className="overflow-hidden overflow-ellipsis text-sm leading-5 text-foreground">
					{((localFontScale ?? 1.0) * 100).toFixed(0)}%
				</div>
			</div>
		</div>
	)
}

export default FontSizeChanger
