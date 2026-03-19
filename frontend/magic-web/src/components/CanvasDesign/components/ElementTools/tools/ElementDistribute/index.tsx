import { useCallback, useMemo, useState } from "react"
import {
	LayoutGrid,
	AlignHorizontalSpaceAround,
	AlignVerticalSpaceAround,
} from "../../../ui/icons/index"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import type { DistributeType } from "../../../../canvas/interaction/AlignmentManager"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function ElementDistribute() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const [selectedValue, setSelectedValue] = useState<string>("")

	const DISTRIBUTE_OPTIONS = useMemo(
		() => [
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
			{
				value: "auto-layout" as const,
				label: t("elementTools.elementDistribute.autoLayout", "自动排列"),
				icon: LayoutGrid,
				shortcut: ["⇧", "A"],
			},
		],
		[t],
	)

	// 处理分布操作
	const handleDistributeChange = useCallback(
		(value: string) => {
			if (!canvas) return

			// 根据分布类型映射到对应的 action ID
			const actionIdMap: Record<DistributeType, string> = {
				"horizontal-spacing": "distribute.horizontal",
				"vertical-spacing": "distribute.vertical",
				"auto-layout": "distribute.auto-layout",
			}

			const distributeType = value as DistributeType
			const actionId = actionIdMap[distributeType]
			if (actionId) {
				canvas.userActionRegistry.execute(actionId)
			}
			// 操作完成后重置为空，这样下次可以再次选择相同的选项
			setTimeout(() => setSelectedValue(""), 0)
		},
		[canvas],
	)

	// 获取当前选中的图标
	const SelectedIcon =
		DISTRIBUTE_OPTIONS.find((opt) => opt.value === selectedValue)?.icon ||
		AlignHorizontalSpaceAround

	return (
		<Select value={selectedValue} onValueChange={handleDistributeChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<SelectedIcon size={16} />
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
								<div className={styles.shortcut}>
									{option.shortcut.map((key, index) => (
										<div key={index} className={styles.key}>
											{key}
										</div>
									))}
								</div>
							</div>
						</SelectItem>
					)
				})}
			</SelectContent>
		</Select>
	)
}
