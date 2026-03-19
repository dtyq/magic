import styles from "./index.module.css"
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover"
import IconButton from "../../../ui/custom/IconButton/index"
import { ToggleGroup, ToggleGroupItem } from "../../../ui/toggle-group"
import {
	ArrowRightFromLine,
	CaseLower,
	CaseSensitive,
	CaseUpper,
	List,
	ListOrdered,
	Minus,
	SlidersHorizontal,
	Strikethrough,
	Underline,
	TextAutoHeight,
	LineHeight,
	WordSpacing,
} from "../../../ui/icons"
import { Input } from "../../../ui/input"
import { useCallback } from "react"
import classNames from "classnames"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

// 文本装饰选项配置
const TEXT_DECORATION_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "underline",
		icon: Underline,
		label: "下划线",
	},
	{
		value: "strikethrough",
		icon: Strikethrough,
		label: "中划线",
	},
] as const

// 列表选项配置
const LIST_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "bullet",
		icon: List,
		label: "无序列表",
	},
	{
		value: "ordered",
		icon: ListOrdered,
		label: "有序列表",
	},
] as const

// 大小写选项配置
const TEXT_CASE_OPTIONS = [
	{
		value: "none",
		icon: Minus,
		label: "无",
	},
	{
		value: "sensitive",
		icon: CaseSensitive,
		label: "大小写敏感",
	},
	{
		value: "upper",
		icon: CaseUpper,
		label: "大写",
	},
	{
		value: "lower",
		icon: CaseLower,
		label: "小写",
	},
] as const

// 文本宽度选项配置
const TEXT_WIDTH_OPTIONS = [
	{
		value: "fixed",
		icon: ArrowRightFromLine,
		label: "固定宽度",
	},
	{
		value: "auto",
		icon: TextAutoHeight,
		label: "自动宽度",
	},
] as const

export default function TextAdvancedButton() {
	const { t } = useCanvasDesignI18n()

	// 处理文本装饰变化
	const handleDecorationChange = useCallback((value: string) => {}, [])

	// 处理列表类型变化
	const handleListTypeChange = useCallback((value: string) => {}, [])

	// 处理文本大小写变化
	const handleTextCaseChange = useCallback((value: string) => {}, [])

	// 处理文本宽度变化
	const handleTextWidthChange = useCallback((value: string) => {}, [])

	return (
		<Popover>
			<PopoverTrigger>
				<div>
					<IconButton className={styles.triggerButton}>
						<SlidersHorizontal size={16} />
						<span className={styles.buttonText}>
							{t("elementTools.shapeStyle.advanced", "高级")}
						</span>
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent className={styles.popoverContent} align="start">
				<div className={styles.textAdvanced}>
					<div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<div className={styles.inputContainer}>
								<LineHeight className={styles.inputIcon} size={16} />
								<Input type="text" className={styles.input} />
							</div>
						</div>
						<div className={styles.textAdvancedGroupItem}>
							<div className={styles.inputContainer}>
								<WordSpacing className={styles.inputIcon} size={16} />
								<Input type="text" className={styles.input} />
							</div>
						</div>
					</div>

					<div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								onValueChange={handleDecorationChange}
								className={styles.toggleGroup}
							>
								{TEXT_DECORATION_OPTIONS.map((option, index) => {
									const Icon = option.icon
									const isActive = index === 0
									return (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											className={classNames(
												styles.toggleGroupItem,
												isActive && styles.toggleGroupItemActive,
											)}
										>
											<Icon size={16} />
										</ToggleGroupItem>
									)
								})}
							</ToggleGroup>
						</div>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								onValueChange={handleListTypeChange}
								className={styles.toggleGroup}
							>
								{LIST_OPTIONS.map((option, index) => {
									const Icon = option.icon
									const isActive = index === 0
									return (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											className={classNames(
												styles.toggleGroupItem,
												isActive && styles.toggleGroupItemActive,
											)}
										>
											<Icon size={16} />
										</ToggleGroupItem>
									)
								})}
							</ToggleGroup>
						</div>
					</div>

					<div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								onValueChange={handleTextCaseChange}
								className={styles.toggleGroup}
							>
								{TEXT_CASE_OPTIONS.map((option, index) => {
									const Icon = option.icon
									const isActive = index === 0
									return (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											className={classNames(
												styles.toggleGroupItem,
												isActive && styles.toggleGroupItemActive,
											)}
										>
											<Icon size={16} />
										</ToggleGroupItem>
									)
								})}
							</ToggleGroup>
						</div>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								onValueChange={handleTextWidthChange}
								className={styles.toggleGroup}
							>
								{TEXT_WIDTH_OPTIONS.map((option, index) => {
									const Icon = option.icon
									const isActive = index === 0
									return (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											className={classNames(
												styles.toggleGroupItem,
												isActive && styles.toggleGroupItemActive,
											)}
										>
											<Icon size={16} />
										</ToggleGroupItem>
									)
								})}
							</ToggleGroup>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
