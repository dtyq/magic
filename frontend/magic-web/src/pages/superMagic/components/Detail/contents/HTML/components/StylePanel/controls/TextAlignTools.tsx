import { Fragment, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Toggle } from "@/components/shadcn-ui/toggle"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import {
	AlignCenter,
	AlignHorizontalJustifyCenter,
	AlignHorizontalJustifyEnd,
	AlignHorizontalJustifyStart,
	AlignJustify,
	AlignLeft,
	AlignRight,
	AlignVerticalJustifyCenter,
	AlignVerticalJustifyEnd,
	AlignVerticalJustifyStart,
} from "lucide-react"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import { STYLE_PANEL_STYLES } from "../styles"
import type { ContextToolbarItemMotion } from "../types"

interface TextAlignToolsProps {
	value: string
	onAlign: (value: string) => void
	disabled?: boolean
	mode?: "text" | "flex"
	flexDirection?: string
	/** Context toolbars omit justify to keep the frequent-action row compact. */
	compact?: boolean
	itemMotion?: ContextToolbarItemMotion
}

/**
 * Text alignment tools component
 */
export function TextAlignTools({
	value,
	onAlign,
	disabled,
	mode = "text",
	flexDirection = "row",
	compact = false,
	itemMotion,
}: TextAlignToolsProps) {
	const { t } = useTranslation("super")
	const renderItem = (children: ReactNode) => itemMotion?.(children) ?? children
	const isFlex = mode === "flex"
	const isVertical = flexDirection.includes("column")
	const isReverse = flexDirection.endsWith("reverse")
	const flexValues = isReverse
		? ["flex-end", "center", "flex-start"]
		: ["flex-start", "center", "flex-end"]
	const flexIcons = isVertical
		? [AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd]
		: [AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd]
	const getFlexLabel = (flexValue: string) =>
		t(
			`stylePanel.layoutValues.${
				flexValue === "flex-start"
					? "flexStart"
					: flexValue === "flex-end"
						? "flexEnd"
						: "center"
			}`,
		)
	const getTextLabel = (textValue: string) =>
		t(
			`stylePanel.${
				textValue === "left"
					? "alignLeft"
					: textValue === "right"
						? "alignRight"
						: textValue === "justify"
							? "alignJustify"
							: "alignCenter"
			}`,
		)
	const renderTooltip = (label: string) => (
		<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
			{label}
		</TooltipContent>
	)

	if (isFlex) {
		return (
			<div className="flex items-center gap-0.5">
				{flexValues.map((flexValue, index) => {
					const Icon = flexIcons[index]
					const label = `${t("stylePanel.justifyContent")}: ${getFlexLabel(flexValue)}`
					return (
						<Fragment key={flexValue}>
							{renderItem(
								<TooltipPrimitive.Root>
									<TooltipTrigger asChild>
										<span>
											<Toggle
												data-testid={`html-editor-flex-align-${flexValue}-button`}
												size="sm"
												pressed={value === flexValue}
												onPressedChange={() => onAlign(flexValue)}
												disabled={disabled}
												className={STYLE_PANEL_STYLES.iconButton}
											>
												<Icon className="h-4 w-4" />
											</Toggle>
										</span>
									</TooltipTrigger>
									{renderTooltip(label)}
								</TooltipPrimitive.Root>,
							)}
						</Fragment>
					)
				})}
			</div>
		)
	}

	const renderTextAlignment = (
		alignment: "left" | "center" | "right" | "justify",
		Icon: typeof AlignLeft,
	) =>
		renderItem(
			<TooltipPrimitive.Root>
				<TooltipTrigger asChild>
					<span>
						<Toggle
							data-testid={`html-editor-text-align-${alignment}-button`}
							size="sm"
							pressed={value === alignment}
							onPressedChange={() => onAlign(alignment)}
							disabled={disabled}
							className={STYLE_PANEL_STYLES.iconButton}
						>
							<Icon className="h-4 w-4" />
						</Toggle>
					</span>
				</TooltipTrigger>
				{renderTooltip(getTextLabel(alignment))}
			</TooltipPrimitive.Root>,
		)

	return (
		<div className="flex items-center gap-0.5">
			{renderTextAlignment("left", AlignLeft)}
			{renderTextAlignment("center", AlignCenter)}
			{renderTextAlignment("right", AlignRight)}
			{compact ? null : renderTextAlignment("justify", AlignJustify)}
		</div>
	)
}
