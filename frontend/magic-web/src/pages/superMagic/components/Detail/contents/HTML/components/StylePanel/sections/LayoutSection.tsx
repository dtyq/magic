import { observer } from "mobx-react-lite"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { DimensionInput, SpacingInput } from "../controls"
import type { StyleSectionProps } from "../types"
import { getDimensionField } from "../utils/dimensionValue"
import { Label } from "@/components/shadcn-ui/label"
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn-ui/select"
import { EditorSelectContent } from "../../EditorFloating"
import { STYLE_PANEL_STYLES } from "../styles"

const DISPLAY_VALUES = ["block", "inline", "inline-block", "flex", "grid", "none"] as const

/**
 * 布局样式配置区域
 */
const LayoutSection = observer(function LayoutSection({
	selectedElement,
	onStyleChange,
	showDimensions = true,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// 解析当前值
	const currentWidth = getDimensionField(selectedElement, "width")
	const currentHeight = getDimensionField(selectedElement, "height")
	const currentMargin = computedStyles?.margin || "0px"
	const currentPadding = computedStyles?.padding || "0px"
	const currentDisplay = computedStyles?.display || "block"

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
		<div className={STYLE_PANEL_STYLES.sectionContent}>
			<div className="space-y-2">
				<h4 className="text-sm font-medium">{t("stylePanel.layoutStyles")}</h4>
			</div>

			{/* 尺寸 */}
			{showDimensions && (
				<div className="grid min-w-0 grid-cols-2 gap-2">
					<DimensionInput
						key={`${selectedElement?.selector ?? "none"}-width`}
						label={t("stylePanel.width")}
						value={currentWidth.value}
						onChange={handleSizeChange("width")}
						placeholder="auto"
						id="width"
						pixelValue={computedStyles?.width}
						valueFromInline={currentWidth.fromInline}
					/>
					<DimensionInput
						key={`${selectedElement?.selector ?? "none"}-height`}
						label={t("stylePanel.height")}
						value={currentHeight.value}
						onChange={handleSizeChange("height")}
						placeholder="auto"
						id="height"
						pixelValue={computedStyles?.height}
						valueFromInline={currentHeight.fromInline}
					/>
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="display" className="text-xs">
					{t("stylePanel.displayType")}
				</Label>
				<Select
					value={currentDisplay}
					onValueChange={(value) => onStyleChange?.("display", value)}
				>
					<SelectTrigger id="display" size="sm" className={STYLE_PANEL_STYLES.control}>
						<SelectValue />
					</SelectTrigger>
					<EditorSelectContent>
						{DISPLAY_VALUES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`stylePanel.displayValues.${value}`)}
							</SelectItem>
						))}
					</EditorSelectContent>
				</Select>
			</div>

			{/* Position */}
			{/* <div className="space-y-2">
				<Label htmlFor="position" className="text-xs">
					{t("stylePanel.positionType")}
				</Label>
				<Select value={currentPosition} onValueChange={handlePositionChange}>
					<SelectTrigger id="position">
						<SelectValue />
					</SelectTrigger>
					<EditorSelectContent>
						{POSITION_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{type}
							</SelectItem>
						))}
					</EditorSelectContent>
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
