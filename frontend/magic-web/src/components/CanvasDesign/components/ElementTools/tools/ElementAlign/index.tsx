import { useCallback, useMemo, useState } from "react"
import {
	AlignStartHorizontal,
	AlignCenterHorizontal,
	AlignEndHorizontal,
	AlignStartVertical,
	AlignCenterVertical,
	AlignEndVertical,
} from "../../../ui/icons/index"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import type { AlignType } from "../../../../canvas/interaction/AlignmentManager"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function ElementAlign() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const [selectedValue, setSelectedValue] = useState<string>("")

	const ALIGN_OPTIONS = useMemo(
		() => [
			{
				value: "left" as const,
				label: t("elementTools.elementAlign.left", "左对齐"),
				icon: AlignStartVertical,
				shortcut: ["⌥", "A"],
			},
			{
				value: "horizontal-center" as const,
				label: t("elementTools.elementAlign.horizontalCenter", "水平居中"),
				icon: AlignCenterVertical,
				shortcut: ["⌥", "H"],
			},
			{
				value: "right" as const,
				label: t("elementTools.elementAlign.right", "右对齐"),
				icon: AlignEndVertical,
				shortcut: ["⌥", "D"],
			},
			{
				value: "top" as const,
				label: t("elementTools.elementAlign.top", "顶部对齐"),
				icon: AlignStartHorizontal,
				shortcut: ["⌥", "W"],
			},
			{
				value: "vertical-center" as const,
				label: t("elementTools.elementAlign.verticalCenter", "垂直居中"),
				icon: AlignCenterHorizontal,
				shortcut: ["⌥", "V"],
			},
			{
				value: "bottom" as const,
				label: t("elementTools.elementAlign.bottom", "底部对齐"),
				icon: AlignEndHorizontal,
				shortcut: ["⌥", "S"],
			},
		],
		[t],
	)

	// 处理对齐操作
	const handleAlignChange = useCallback(
		(value: string) => {
			if (!canvas) return

			// 根据对齐类型映射到对应的 action ID
			const actionIdMap: Record<AlignType, string> = {
				left: "align.left",
				"horizontal-center": "align.horizontal-center",
				right: "align.right",
				top: "align.top",
				"vertical-center": "align.vertical-center",
				bottom: "align.bottom",
			}

			const alignType = value as AlignType
			const actionId = actionIdMap[alignType]
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
		ALIGN_OPTIONS.find((opt) => opt.value === selectedValue)?.icon || AlignStartHorizontal

	return (
		<Select value={selectedValue} onValueChange={handleAlignChange}>
			<SelectTrigger className={styles.selectTrigger}>
				<SelectedIcon size={16} />
			</SelectTrigger>
			<SelectContent style={{ width: 240 }}>
				{ALIGN_OPTIONS.map((option) => {
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
