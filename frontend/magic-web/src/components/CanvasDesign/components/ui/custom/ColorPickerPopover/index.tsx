import {
	ColorPicker as ShadcnColorPicker,
	ColorPickerAlpha,
	ColorPickerEyeDropper,
	ColorPickerFormat,
	ColorPickerHue,
	ColorPickerOutput,
	ColorPickerSelection,
	type ColorPickerProps as ShadcnColorPickerProps,
} from "./color-picker"
import { Popover, PopoverContent, PopoverTrigger } from "../../popover"
import transparentIcon from "../../../../assets/svg/transparent.svg"
import classNames from "classnames"
import { type ReactNode, useCallback, useState } from "react"
import styles from "./index.module.css"

export interface ColorPickerPopoverProps {
	/** 触发器内容 */
	children: ReactNode
	/** 当前颜色值 */
	value?: string
	/** 颜色变化回调 */
	onChange?: (rgba: [number, number, number, number]) => void
	/** 颜色模式 */
	mode?: "hex" | "rgb" | "hsl"
	/** 颜色模式变化回调 */
	onModeChange?: (mode: "hex" | "rgb" | "hsl") => void
	/** 是否透明 */
	isTransparent?: boolean
	/** 透明按钮点击回调 */
	onTransparentClick?: () => void
	/** 标题 */
	title?: string
	/** 标题下方的额外内容 */
	extraContent?: ReactNode
	/** Popover 对齐方式 */
	align?: "start" | "center" | "end"
	/** Popover 位置 */
	side?: "top" | "right" | "bottom" | "left"
	/** 默认颜色 */
	defaultColor?: string
	/** Popover 打开状态变化回调 */
	onOpenChange?: (open: boolean) => void
	/** 是否显示透明按钮 */
	showTransparentToggle?: boolean
	/** 内容区交互时恢复外部编辑器选区 */
	onContentPreserveSelection?: () => void
}

export default function ColorPickerPopover({
	children,
	value,
	onChange,
	mode,
	onModeChange,
	isTransparent = false,
	onTransparentClick,
	title = "颜色",
	extraContent,
	align = "start",
	side = "bottom",
	defaultColor = "#000000",
	onOpenChange,
	showTransparentToggle = true,
	onContentPreserveSelection,
}: ColorPickerPopoverProps) {
	const [open, setOpen] = useState(false)
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen)
			onOpenChange?.(nextOpen)
		},
		[onOpenChange],
	)
	const handleContentPointerDownCapture = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (shouldAllowNativeFocus(event.target)) {
				return
			}
			requestAnimationFrame(() => {
				onContentPreserveSelection?.()
			})
		},
		[onContentPreserveSelection],
	)
	const handleCloseAutoFocus = useCallback(
		(event: Event) => {
			if (!onContentPreserveSelection) {
				return
			}
			event.preventDefault()
			requestAnimationFrame(() => {
				onContentPreserveSelection()
			})
		},
		[onContentPreserveSelection],
	)
	const handleEscapeKeyDown = useCallback(
		(event: KeyboardEvent) => {
			event.preventDefault()
			event.stopPropagation()
			handleOpenChange(false)
		},
		[handleOpenChange],
	)

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className={styles.colorPickerPopover}
				align={align}
				side={side}
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={handleCloseAutoFocus}
				onEscapeKeyDown={handleEscapeKeyDown}
				onPointerDownCapture={handleContentPointerDownCapture}
			>
				<ShadcnColorPicker
					className={classNames(styles.colorPicker, styles.colorPickerGap)}
					value={value || defaultColor}
					onChange={onChange as NonNullable<ShadcnColorPickerProps["onChange"]>}
					mode={mode}
					onModeChange={onModeChange}
				>
					<div className={styles.colorPickerTitle}>{title}</div>
					{extraContent}
					<div className={styles.colorPickerSelection}>
						<ColorPickerSelection />
					</div>
					<div className={classNames("flex items-center", styles.colorPickerGap)}>
						{showTransparentToggle && (
							<div
								className={classNames(
									styles.transparentButton,
									isTransparent && styles.transparentButtonActive,
								)}
								onClick={onTransparentClick}
							>
								<img src={transparentIcon} alt="transparent" />
							</div>
						)}
						<ColorPickerEyeDropper />
						<div className="grid w-full gap-1">
							<ColorPickerHue />
							<ColorPickerAlpha />
						</div>
					</div>
					<div className={classNames("flex items-center", styles.colorPickerGap)}>
						<ColorPickerOutput />
						<ColorPickerFormat />
					</div>
				</ShadcnColorPicker>
			</PopoverContent>
		</Popover>
	)
}

function shouldAllowNativeFocus(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest(
			"input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable]",
		) !== null
	)
}
