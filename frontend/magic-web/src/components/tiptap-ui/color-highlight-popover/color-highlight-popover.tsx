import * as React from "react"
import { type Editor } from "@tiptap/react"
import { useTranslation } from "react-i18next"

// --- Hooks ---
import { useMenuNavigation } from "@/hooks/use-menu-navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Icons ---
import { BanIcon } from "@/components/tiptap-icons/ban-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button"
import {
	Popover,
	PopoverTrigger,
	PopoverContent,
} from "@/components/tiptap-ui-primitive/popover"
import { Separator } from "@/components/tiptap-ui-primitive/separator"
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card"

// --- Tiptap UI ---
import type {
	HighlightColor,
	UseColorHighlightConfig,
} from "@/components/tiptap-ui/color-highlight-button"
import {
	ColorHighlightButton,
	pickHighlightColorsByValue,
	useColorHighlight,
} from "@/components/tiptap-ui/color-highlight-button"

export interface ColorHighlightPopoverContentProps {
	/**
	 * The Tiptap editor instance.
	 */
	editor?: Editor | null
	/**
	 * Optional colors to use in the highlight popover.
	 * If not provided, defaults to a predefined set of colors.
	 */
	colors?: HighlightColor[]
}

export interface ColorHighlightPopoverProps
	extends
	Omit<ButtonProps, "type">,
	Pick<UseColorHighlightConfig, "editor" | "hideWhenUnavailable" | "onApplied"> {
	/**
	 * Optional colors to use in the highlight popover.
	 * If not provided, defaults to a predefined set of colors.
	 */
	colors?: HighlightColor[]
}

export const ColorHighlightPopoverButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, children, ...props }, ref) => {
		const { t } = useTranslation("tiptap")

		return (
			<Button
				type="button"
				className={className}
				data-style="ghost"
				data-appearance="default"
				role="button"
				tabIndex={-1}
				aria-label={t("toolbar.colorHighlight.ariaLabel")}
				tooltip={t("toolbar.colorHighlight.tooltip")}
				ref={ref}
				{...props}
			>
				{children ?? <HighlighterIcon className="tiptap-button-icon" />}
			</Button>
		)
	},
)

export function ColorHighlightPopoverContent({
	editor,
	colors = pickHighlightColorsByValue([
		"var(--tt-color-highlight-green)",
		"var(--tt-color-highlight-blue)",
		"var(--tt-color-highlight-red)",
		"var(--tt-color-highlight-purple)",
		"var(--tt-color-highlight-yellow)",
	]),
}: ColorHighlightPopoverContentProps) {
	const { handleRemoveHighlight } = useColorHighlight({ editor })
	const { t } = useTranslation("tiptap")
	const isMobile = useIsMobile()
	const containerRef = React.useRef<HTMLDivElement>(null)

	const getColorLabel = React.useCallback(
		(color: HighlightColor) => {
			return t(`toolbar.colorHighlight.colors.${color.key}`)
		},
		[t],
	)

	const menuItems = React.useMemo(
		() => [
			...colors.map((color) => ({ label: getColorLabel(color), value: color.value })),
			{ label: t("toolbar.colorHighlight.removeHighlight"), value: "none" },
		],
		[colors, getColorLabel, t],
	)

	const { selectedIndex } = useMenuNavigation({
		containerRef,
		items: menuItems,
		orientation: "both",
		onSelect: (item) => {
			if (!containerRef.current) return false
			const highlightedElement = containerRef.current.querySelector(
				'[data-highlighted="true"]',
			) as HTMLElement
			if (highlightedElement) highlightedElement.click()
			if (item.value === "none") handleRemoveHighlight()
		},
		autoSelectFirstItem: false,
	})

	return (
		<Card
			ref={containerRef}
			tabIndex={0}
			style={isMobile ? { boxShadow: "none", border: 0 } : {}}
		>
			<CardBody style={isMobile ? { padding: 0 } : {}}>
				<CardItemGroup orientation="horizontal">
					<ButtonGroup orientation="horizontal">
						{colors.map((color, index) => {
							const colorLabel = getColorLabel(color)
							return (
								<ColorHighlightButton
									key={color.value}
									editor={editor}
									highlightColor={color.value}
									tooltip={colorLabel}
									aria-label={colorLabel}
									tabIndex={index === selectedIndex ? 0 : -1}
									data-highlighted={selectedIndex === index}
								/>
							)
						})}
					</ButtonGroup>
					<Separator />
					<ButtonGroup orientation="horizontal">
						<Button
							onClick={handleRemoveHighlight}
							aria-label={t("toolbar.colorHighlight.removeHighlight")}
							tooltip={t("toolbar.colorHighlight.removeHighlight")}
							tabIndex={selectedIndex === colors.length ? 0 : -1}
							type="button"
							role="menuitem"
							data-style="ghost"
							data-highlighted={selectedIndex === colors.length}
						>
							<BanIcon className="tiptap-button-icon" />
						</Button>
					</ButtonGroup>
				</CardItemGroup>
			</CardBody>
		</Card>
	)
}

export function ColorHighlightPopover({
	editor: providedEditor,
	colors = pickHighlightColorsByValue([
		"var(--tt-color-highlight-green)",
		"var(--tt-color-highlight-blue)",
		"var(--tt-color-highlight-red)",
		"var(--tt-color-highlight-purple)",
		"var(--tt-color-highlight-yellow)",
	]),
	hideWhenUnavailable = false,
	onApplied,
	...props
}: ColorHighlightPopoverProps) {
	const { editor } = useTiptapEditor(providedEditor)
	const [isOpen, setIsOpen] = React.useState(false)
	const { isVisible, canColorHighlight, isActive, label, Icon } = useColorHighlight({
		editor,
		hideWhenUnavailable,
		onApplied,
	})

	if (!isVisible) return null

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<ColorHighlightPopoverButton
					disabled={!canColorHighlight}
					data-active-state={isActive ? "on" : "off"}
					data-disabled={!canColorHighlight}
					aria-pressed={isActive}
					aria-label={label}
					tooltip={label}
					{...props}
				>
					<Icon className="tiptap-button-icon" />
				</ColorHighlightPopoverButton>
			</PopoverTrigger>
			<PopoverContent aria-label="Highlight colors">
				<ColorHighlightPopoverContent editor={editor} colors={colors} />
			</PopoverContent>
		</Popover>
	)
}

export default ColorHighlightPopover
