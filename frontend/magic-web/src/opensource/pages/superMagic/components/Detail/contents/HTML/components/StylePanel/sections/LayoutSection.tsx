import { observer } from "mobx-react-lite"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { DimensionInput, SpacingInput } from "../controls"
import type { StyleSectionProps } from "../types"

/**
 * 布局样式配置区域
 */
const LayoutSection = observer(function LayoutSection({
	selectedElement,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// 解析当前值
	const currentWidth = computedStyles?.width || "auto"
	const currentHeight = computedStyles?.height || "auto"
	const currentMargin = computedStyles?.margin || "0px"
	const currentPadding = computedStyles?.padding || "0px"

	/**
	 * 处理尺寸变化
	 */
	const handleSizeChange = useCallback(
		(property: "width" | "height") => (value: string) => {
			if (value.trim()) {
				onStyleChange?.(property, value)
			}
		},
		[onStyleChange],
	)

	/**
	 * 处理边距变化
	 */
	const handleMarginChange = useCallback(
		(value: string) => {
			if (value.trim()) {
				onStyleChange?.("margin", value)
			}
		},
		[onStyleChange],
	)

	/**
	 * 处理内边距变化
	 */
	const handlePaddingChange = useCallback(
		(value: string) => {
			if (value.trim()) {
				onStyleChange?.("padding", value)
			}
		},
		[onStyleChange],
	)

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h4 className="text-sm font-medium">{t("stylePanel.layoutStyles")}</h4>
			</div>

			{/* 尺寸 */}
			<div className="grid grid-cols-2 gap-3">
				<DimensionInput
					label={t("stylePanel.width")}
					value={currentWidth}
					onChange={handleSizeChange("width")}
					placeholder="auto"
					id="width"
				/>
				<DimensionInput
					label={t("stylePanel.height")}
					value={currentHeight}
					onChange={handleSizeChange("height")}
					placeholder="auto"
					id="height"
				/>
			</div>

			{/* Display */}
			{/* <div className="space-y-2">
				<Label htmlFor="display" className="text-xs">
					{t("stylePanel.displayType")}
				</Label>
				<Select value={currentDisplay} onValueChange={handleDisplayChange}>
					<SelectTrigger id="display">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DISPLAY_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{type}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div> */}

			{/* Position */}
			{/* <div className="space-y-2">
				<Label htmlFor="position" className="text-xs">
					{t("stylePanel.positionType")}
				</Label>
				<Select value={currentPosition} onValueChange={handlePositionChange}>
					<SelectTrigger id="position">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{POSITION_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{type}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div> */}

			{/* 外边距 */}
			<SpacingInput
				label={t("stylePanel.marginLabel")}
				value={currentMargin}
				onChange={handleMarginChange}
				id="margin"
			/>

			{/* 内边距 */}
			<SpacingInput
				label={t("stylePanel.paddingLabel")}
				value={currentPadding}
				onChange={handlePaddingChange}
				id="padding"
			/>
		</div>
	)
})

export default LayoutSection
