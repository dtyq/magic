import { Filter } from "lucide-react"
import { cn } from "../../../runtime/shared/lib/utils"
import { ElementTypeEnum, type ElementType } from "../../../runtime/document/types"
import type { CanvasLayersFilterState } from "../../../public/magic-types"
import { useEffect, useRef, useState } from "react"
import { useCanvasDesignI18n } from "../../../app/providers/I18nProvider"
import { Checkbox } from "../../primitives/shadcn/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/shadcn/popover"
import { RadioGroup, RadioGroupItem } from "../../../../shadcn-ui/radio-group"
import styles from "./index.module.css"

const LAYER_TYPE_OPTIONS: Array<{ value: ElementType; labelKey: string; fallback: string }> = [
	{ value: ElementTypeEnum.Frame, labelKey: "layers.filter.types.frame", fallback: "画框" },
	{ value: ElementTypeEnum.Image, labelKey: "layers.filter.types.image", fallback: "图片" },
	{ value: ElementTypeEnum.Text, labelKey: "layers.filter.types.text", fallback: "文本" },
	{ value: ElementTypeEnum.Video, labelKey: "layers.filter.types.video", fallback: "视频" },
	{ value: ElementTypeEnum.Audio, labelKey: "layers.filter.types.audio", fallback: "音频" },
	{
		value: ElementTypeEnum.Storyboard,
		labelKey: "layers.filter.types.storyboard",
		fallback: "分镜",
	},
	{
		value: ElementTypeEnum.VideoEdit,
		labelKey: "layers.filter.types.videoEdit",
		fallback: "视频编辑",
	},
]

interface LayersFilterPopoverProps {
	filter: CanvasLayersFilterState
	isActive: boolean
	isOpen: boolean
	onOpenChange: (open: boolean) => void
	onFilterChange: <K extends keyof CanvasLayersFilterState>(
		key: K,
		value: CanvasLayersFilterState[K],
	) => void
	onReset: () => void
}

export default function LayersFilterPopover(props: LayersFilterPopoverProps) {
	const { filter, isActive, isOpen, onOpenChange, onFilterChange, onReset } = props
	const { t } = useCanvasDesignI18n()

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						styles.layersFilterTrigger,
						isActive && styles.layersFilterTriggerActive,
					)}
					aria-label={t("layers.filter.open", "筛选图层")}
					aria-pressed={isActive}
				>
					<Filter size={14} />
					{isActive && <span className={styles.layersFilterActiveDot} />}
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="right"
				align="start"
				sideOffset={6}
				className={styles.layersFilterPopoverContent}
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<LayersFilterForm
					filter={filter}
					isActive={isActive}
					onFilterChange={onFilterChange}
					onReset={onReset}
				/>
			</PopoverContent>
		</Popover>
	)
}

export function LayersFilterForm({
	filter,
	isActive = false,
	onFilterChange,
	onReset,
}: Omit<LayersFilterPopoverProps, "isOpen" | "onOpenChange">) {
	const { t } = useCanvasDesignI18n()
	const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false)
	const typeSelectRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!isTypeSelectOpen) return

		const handlePointerDown = (event: PointerEvent) => {
			if (!typeSelectRef.current?.contains(event.target as Node)) {
				setIsTypeSelectOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsTypeSelectOpen(false)
		}

		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [isTypeSelectOpen])
	const selectedTypeLabels = LAYER_TYPE_OPTIONS.filter((option) =>
		filter.types.includes(option.value),
	).map((option) => t(option.labelKey, option.fallback))
	const typeSelectLabel = filter.types.length
		? selectedTypeLabels.join("、")
		: t("layers.filter.types.all", "全部类型")

	return (
		<div className={styles.layersFilterPanel}>
			<div className={styles.layersFilterPanelHeader}>
				<span className={styles.layersFilterPanelTitle}>
					{t("layers.filter.title", "筛选")}
				</span>
				{onReset ? (
					<button
						type="button"
						className={styles.layersFilterReset}
						disabled={!isActive}
						onClick={onReset}
					>
						{t("layers.filter.reset", "重置")}
					</button>
				) : null}
			</div>
			<FilterSegmentSection
				title={t("layers.filter.visibility.label", "可见状态")}
				value={filter.visibility}
				options={[
					["all", "layers.filter.visibility.all", "全部"],
					["visible", "layers.filter.visibility.visible", "可见"],
					["hidden", "layers.filter.visibility.hidden", "隐藏"],
				]}
				onChange={(value) => onFilterChange("visibility", value)}
			/>
			<FilterSegmentSection
				title={t("layers.filter.locked.label", "锁定状态")}
				value={filter.locked}
				options={[
					["all", "layers.filter.locked.all", "全部"],
					["locked", "layers.filter.locked.locked", "已锁定"],
					["unlocked", "layers.filter.locked.unlocked", "未锁定"],
				]}
				onChange={(value) => onFilterChange("locked", value)}
			/>
			<div className={styles.layersFilterSection}>
				<span className={styles.layersFilterSectionTitle}>
					{t("layers.filter.typeLabel", "元素类型")}
				</span>
				<div ref={typeSelectRef} className={styles.layersFilterTypeSelectWrapper}>
					<button
						type="button"
						className={styles.layersFilterTypeSelectTrigger}
						aria-label={t("layers.filter.typeLabel", "元素类型")}
						aria-expanded={isTypeSelectOpen}
						onClick={() => setIsTypeSelectOpen((open) => !open)}
					>
						<span>{typeSelectLabel}</span>
						<span className={styles.layersFilterTypeSelectChevron}>⌄</span>
					</button>
					{isTypeSelectOpen && (
						<div
							className={styles.layersFilterTypeSelectMenu}
							role="listbox"
							aria-multiselectable="true"
						>
							<div
								className={styles.layersFilterTypeOption}
								role="option"
								tabIndex={0}
								aria-selected={filter.types.length === 0}
								onClick={() => onFilterChange("types", [])}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ")
										onFilterChange("types", [])
								}}
							>
								<Checkbox checked={filter.types.length === 0} tabIndex={-1} />
								<span>{t("layers.filter.types.all", "全部类型")}</span>
							</div>
							{LAYER_TYPE_OPTIONS.map((option) => {
								const checked = filter.types.includes(option.value)
								return (
									<div
										key={option.value}
										className={styles.layersFilterTypeOption}
										role="option"
										tabIndex={0}
										aria-selected={checked}
										onClick={() =>
											onFilterChange(
												"types",
												checked
													? filter.types.filter(
															(type) => type !== option.value,
														)
													: [...filter.types, option.value],
											)
										}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												onFilterChange(
													"types",
													checked
														? filter.types.filter(
																(type) => type !== option.value,
															)
														: [...filter.types, option.value],
												)
											}
										}}
									>
										<Checkbox checked={checked} tabIndex={-1} />
										<span>{t(option.labelKey, option.fallback)}</span>
									</div>
								)
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

function FilterSegmentSection<T extends string>(props: {
	title: string
	value: T
	options: readonly [T, string, string][]
	onChange: (value: T) => void
}) {
	const { title, value, options, onChange } = props
	const { t } = useCanvasDesignI18n()

	return (
		<div className={styles.layersFilterSection}>
			<span className={styles.layersFilterSectionTitle}>{title}</span>
			<RadioGroup
				value={value}
				onValueChange={(nextValue) => onChange(nextValue as T)}
				className={styles.layersFilterRadioGroup}
				aria-label={title}
			>
				{options.map(([optionValue, key, fallback]) => (
					<label key={optionValue} className={styles.layersFilterRadioOption}>
						<RadioGroupItem
							value={optionValue}
							id={`layers-filter-${title}-${optionValue}`}
						/>
						{t(key, fallback)}
					</label>
				))}
			</RadioGroup>
		</div>
	)
}
