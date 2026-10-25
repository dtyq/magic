import { useCallback, useMemo, useState } from "react"
import {
	AlignHorizontalSpaceAround,
	AlignVerticalSpaceAround,
	Columns3,
	Grid3X3,
	LayoutGrid,
	Network,
	Rows3,
	Sparkles,
} from "lucide-react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "../../../../primitives/shadcn/select"
import styles from "./index.module.css"
import type {
	ArrangementMode,
	DistributeType,
} from "../../../../../runtime/interaction/align/AlignmentManager"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"

type MenuMode = ArrangementMode | "horizontal-spacing" | "vertical-spacing"

export default function ElementDistribute() {
	const { t } = useCanvasDesignI18n()
	const tool = useElementToolResolution()
	const [selectedValue, setSelectedValue] = useState<string>("")

	const DISTRIBUTE_OPTIONS = useMemo(
		() =>
			[
				{
					value: "smart" as const,
					label: t("elementTools.elementDistribute.smart", "智能排列"),
					icon: Sparkles,
					shortcut: ["⇧", "A"],
				},
				{
					value: "layered" as const,
					label: t("elementTools.elementDistribute.layered", "按连线分层排列"),
					icon: Network,
				},
				{
					value: "type-group" as const,
					label: t("elementTools.elementDistribute.typeGroup", "按类型分组排列"),
					icon: LayoutGrid,
				},
				{
					value: "compact-grid" as const,
					label: t("elementTools.elementDistribute.compactGrid", "紧凑网格排列"),
					icon: Grid3X3,
				},
				{
					value: "horizontal-row" as const,
					label: t("elementTools.elementDistribute.horizontalRow", "横向一行排列"),
					icon: Rows3,
				},
				{
					value: "vertical-column" as const,
					label: t("elementTools.elementDistribute.verticalColumn", "纵向一列排列"),
					icon: Columns3,
				},
				{
					value: "horizontal-spacing" as const,
					label: t("elementTools.elementDistribute.horizontalSpacing", "水平间距"),
					icon: AlignHorizontalSpaceAround,
					shortcut: ["⇧", "H"],
				},
				{
					value: "vertical-spacing" as const,
					label: t("elementTools.elementDistribute.verticalSpacing", "垂直间距"),
					icon: AlignVerticalSpaceAround,
					shortcut: ["⇧", "V"],
				},
			] satisfies Array<{
				value: MenuMode
				label: string
				icon: typeof Network
				shortcut?: string[]
			}>,
		[t],
	)

	const handleDistributeChange = useCallback(
		(value: string) => {
			if (tool?.visibility === "visible") {
				const mode = value as DistributeType
				if (mode === "horizontal-spacing") {
					void tool.execute?.({ actionId: "distribute.horizontal" })
				} else if (mode === "vertical-spacing") {
					void tool.execute?.({ actionId: "distribute.vertical" })
				} else {
					void tool.execute?.({ actionId: "distribute.arrange", mode })
				}
			}
			setTimeout(() => setSelectedValue(""), 0)
		},
		[tool],
	)

	const SelectedIcon =
		DISTRIBUTE_OPTIONS.find((option) => option.value === selectedValue)?.icon || Grid3X3
	const arrangeLabel = t("elementTools.elementDistribute.title", "排列方式")

	return (
		<Select
			value={selectedValue}
			onValueChange={handleDistributeChange}
			disabled={tool?.visibility !== "visible"}
		>
			<SelectTrigger className={styles.selectTrigger} aria-label={arrangeLabel}>
				<SelectedIcon size={16} />
				<span className={styles.triggerLabel}>{arrangeLabel}</span>
			</SelectTrigger>
			<SelectContent style={{ width: 240 }}>
				{DISTRIBUTE_OPTIONS.map((option) => {
					const Icon = option.icon
					return (
						<SelectItem
							key={option.value}
							value={option.value}
							className={styles.selectOptionItem}
						>
							<div className={styles.selectOptionItemContent}>
								<Icon size={16} className={styles.icon} />
								<span className={styles.label}>{option.label}</span>
								{option.shortcut ? (
									<div className={styles.shortcut}>
										{option.shortcut.map((key) => (
											<div key={key} className={styles.key}>
												{key}
											</div>
										))}
									</div>
								) : null}
							</div>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}
