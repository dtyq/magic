import { useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import { ChevronsUpDown } from "../../../ui/icons/index"
import styles from "../ResolutionSelect/index.module.css"

export interface SizeOption {
	/** 显示的标签 */
	label: string
	/** 选项的值（宽x高格式），如 "1024x1024" */
	value: string
	/** 是否禁用 */
	disabled?: boolean
	/** 完整的 image_size_config item */
	data: {
		/** 尺寸比例标签，如 "1:1", "16:9" */
		label: string
		/** 尺寸值，格式为 "宽度x高度"，如 "1024x1024" */
		value: string
		/** 分辨率等级，如 "1K", "2K", "4K" */
		scale: string
	}
}

interface SizeSelectProps {
	/** 尺寸选项列表 */
	options: SizeOption[]
	/** 当前选中的值（宽x高格式） */
	value?: string
	/** 值变化回调 */
	onValueChange?: (value: string) => void
	/** 是否禁用 */
	disabled?: boolean
	/** 自定义样式类名 */
	className?: string
}

export default function SizeSelect({
	options,
	value,
	onValueChange,
	disabled = false,
	className,
}: SizeSelectProps) {
	// 当前选中的选项
	const selectedOption = useMemo(() => {
		return options.find((opt) => opt.value === value)
	}, [options, value])

	// 如果没有选项，不渲染
	if (options.length === 0) {
		return null
	}

	// 判断是否有值
	const hasValue = !!value

	return (
		<Select value={value || ""} onValueChange={onValueChange} disabled={disabled}>
			<SelectTrigger className={`${styles.selectTrigger} ${className || ""}`}>
				<span className={styles.selectTriggerText}>
					{selectedOption?.label || "分辨率"}
				</span>
				<ChevronsUpDown size={16} />
			</SelectTrigger>
			<SelectContent className={styles.selectContent} style={{ width: 200 }}>
				<div className={styles.selectContentName}>分辨率</div>
				{options.map((option) => {
					if (!option || !option.value) return null
					return (
						<SelectItem
							key={option.value}
							value={option.value}
							className={`${styles.selectOptionItem} ${
								hasValue ? styles.selectOptionItemWithValue : ""
							}`}
							disabled={option.disabled}
						>
							<div className={styles.sizeOptionItemContent}>
								<div className={styles.label}>{option.label}</div>
								<div className={styles.size}>{option.value}</div>
							</div>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}
