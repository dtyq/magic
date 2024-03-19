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
import { type ReactNode } from "react"
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
	/** 默认颜色 */
	defaultColor?: string
	/** Popover 打开状态变化回调 */
	onOpenChange?: (open: boolean) => void
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
	defaultColor = "#000000",
	onOpenChange,
}: ColorPickerPopoverProps) {
	return (
		<Popover onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				className={styles.colorPickerPopover}
				align={align}
				onOpenAutoFocus={(e) => e.preventDefault()}
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
						<div
							className={classNames(
								styles.transparentButton,
								isTransparent && styles.transparentButtonActive,
							)}
							onClick={onTransparentClick}
						>
							<img src={transparentIcon} alt="transparent" />
						</div>
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
