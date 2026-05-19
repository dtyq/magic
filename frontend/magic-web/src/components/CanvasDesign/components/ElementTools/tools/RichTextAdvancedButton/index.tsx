import styles from "./index.module.css"
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover"
import IconButton from "../../../ui/custom/IconButton/index"
import { ToggleGroup, ToggleGroupItem } from "../../../ui/toggle-group"
import { SlidersHorizontal } from "lucide-react"
import { LineHeight, WordSpacing } from "../../../ui/icons"
import { NumberStepperInput } from "../../../ui/custom/NumberStepperInput"
import {
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import classNames from "classnames"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import type { TextListTypeValue } from "../../../../canvas/text/editorFormatting"
import {
	formatTypographyMetricForInput,
	roundTypographyMetric,
	TYPOGRAPHY_DECIMAL_PLACES,
} from "../../../../canvas/text/typographyMetrics"
import {
	DEFAULT_TEXT_LETTER_SPACING,
	DEFAULT_TEXT_LINE_HEIGHT,
} from "../../../../canvas/text/richText"
import type { RichTextParagraph } from "../../../../canvas/types"
import { useTextToolController } from "../text/useTextToolController"
import {
	RICH_TEXT_DECORATION_OPTIONS,
	RICH_TEXT_LIST_OPTIONS,
	// RICH_TEXT_CASE_OPTIONS,
	// RICH_TEXT_WIDTH_OPTIONS,
} from "./options"

type RichTextDecorationValue = (typeof RICH_TEXT_DECORATION_OPTIONS)[number]["value"]
type RichTextListValue = (typeof RICH_TEXT_LIST_OPTIONS)[number]["value"]

function getUniformParagraphStyleValue<T>(
	content: RichTextParagraph[] | undefined,
	getValue: (style: NonNullable<RichTextParagraph["style"]> | undefined) => T,
): T | null {
	if (!content?.length) {
		return null
	}

	const [firstParagraph, ...restParagraphs] = content
	const firstValue = getValue(firstParagraph.style)
	return restParagraphs.every((paragraph) => getValue(paragraph.style) === firstValue)
		? firstValue
		: null
}

function shouldAllowNativeFocus(target: EventTarget | null): boolean {
	return (
		target instanceof Element &&
		target.closest(
			"input, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable]",
		) !== null
	)
}

function formatMetricInputValue(value: number | null | undefined): string {
	return value === null || value === undefined
		? ""
		: formatTypographyMetricForInput(value, TYPOGRAPHY_DECIMAL_PLACES)
}

function sanitizeMetricInput(value: string): string {
	let output = ""
	let hasSign = false
	let hasDot = false
	let decimalCount = 0

	for (const char of value) {
		if (char === "-") {
			if (!hasSign && output.length === 0) {
				output += char
				hasSign = true
			}
			continue
		}

		if (char === ".") {
			if (!hasDot) {
				output += char
				hasDot = true
			}
			continue
		}

		if (!/\d/.test(char)) {
			continue
		}

		if (hasDot) {
			if (decimalCount >= TYPOGRAPHY_DECIMAL_PLACES) {
				continue
			}
			decimalCount++
		}
		output += char
	}

	return output
}

function isCompleteMetricInput(value: string): boolean {
	return value !== "" && value !== "-" && value !== "." && value !== "-." && !value.endsWith(".")
}

function areMetricValuesEqual(
	left: number | null | undefined,
	right: number | null | undefined,
): boolean {
	if (left === null || left === undefined || right === null || right === undefined) {
		return left === right
	}
	return (
		roundTypographyMetric(left, TYPOGRAPHY_DECIMAL_PLACES) ===
		roundTypographyMetric(right, TYPOGRAPHY_DECIMAL_PLACES)
	)
}

export default function RichTextAdvancedButton() {
	const { t } = useCanvasDesignI18n()
	const autoMetricPlaceholder = t("elementTools.richTextAdvanced.auto", "自动")
	const {
		state,
		selectedTextElement,
		isEditingText,
		resolvedDefaultStyle,
		restoreSelection,
		setLineHeight,
		setLetterSpacing,
		setUnderline,
		setStrikethrough,
		setListType,
	} = useTextToolController()
	const [lineHeightInputValue, setLineHeightInputValue] = useState("")
	const [letterSpacingInputValue, setLetterSpacingInputValue] = useState("")
	const skipNextMetricBlurRef = useRef(false)
	const isInteractingInsidePopoverRef = useRef(false)
	const [open, setOpen] = useState(false)

	const selectedElementLineHeight = useMemo(
		() =>
			getUniformParagraphStyleValue(
				selectedTextElement?.content,
				(style) => style?.lineHeight ?? null,
			),
		[selectedTextElement?.content],
	)
	const selectedElementListType = useMemo(
		() =>
			getUniformParagraphStyleValue(
				selectedTextElement?.content,
				(style) => style?.listType ?? null,
			),
		[selectedTextElement?.content],
	)
	const displayedLineHeight =
		isEditingText && state.lineHeight !== null ? state.lineHeight : selectedElementLineHeight
	const displayedLetterSpacing =
		isEditingText && state.letterSpacing !== null
			? state.letterSpacing
			: (resolvedDefaultStyle.letterSpacing ?? null)
	const displayedUnderline =
		isEditingText && state.underline !== null ? state.underline : resolvedDefaultStyle.underline
	const displayedStrikethrough =
		isEditingText && state.strikethrough !== null
			? state.strikethrough
			: resolvedDefaultStyle.strikethrough
	let displayedDecoration: RichTextDecorationValue = "none"
	if (displayedUnderline === true) {
		displayedDecoration = "underline"
	} else if (displayedStrikethrough === true) {
		displayedDecoration = "strikethrough"
	}
	const displayedListType: RichTextListValue =
		(isEditingText && state.listType !== null ? state.listType : selectedElementListType) ??
		"none"

	useEffect(() => {
		setLineHeightInputValue(formatMetricInputValue(displayedLineHeight))
	}, [displayedLineHeight])

	useEffect(() => {
		setLetterSpacingInputValue(formatMetricInputValue(displayedLetterSpacing))
	}, [displayedLetterSpacing])

	const commitLineHeight = useCallback(
		(value: string) => {
			if (value.trim() === "") {
				setLineHeightInputValue("")
				if (displayedLineHeight === null || displayedLineHeight === undefined) {
					return
				}
				setLineHeight(undefined)
				return
			}
			const parsedValue = Number.parseFloat(value)
			if (!isCompleteMetricInput(value) || Number.isNaN(parsedValue)) {
				setLineHeightInputValue(formatMetricInputValue(displayedLineHeight))
				return
			}
			const rounded = roundTypographyMetric(
				Math.max(parsedValue, 0.1),
				TYPOGRAPHY_DECIMAL_PLACES,
			)
			setLineHeightInputValue(
				formatTypographyMetricForInput(rounded, TYPOGRAPHY_DECIMAL_PLACES),
			)
			if (areMetricValuesEqual(rounded, displayedLineHeight)) {
				return
			}
			setLineHeight(rounded)
		},
		[displayedLineHeight, setLineHeight],
	)

	const commitLetterSpacing = useCallback(
		(value: string) => {
			if (value.trim() === "") {
				setLetterSpacingInputValue("")
				if (displayedLetterSpacing === null || displayedLetterSpacing === undefined) {
					return
				}
				setLetterSpacing(undefined)
				return
			}
			const parsedValue = Number.parseFloat(value)
			if (!isCompleteMetricInput(value) || Number.isNaN(parsedValue)) {
				setLetterSpacingInputValue(formatMetricInputValue(displayedLetterSpacing))
				return
			}
			const rounded = roundTypographyMetric(
				Math.max(parsedValue, 0),
				TYPOGRAPHY_DECIMAL_PLACES,
			)
			setLetterSpacingInputValue(
				formatTypographyMetricForInput(rounded, TYPOGRAPHY_DECIMAL_PLACES),
			)
			if (areMetricValuesEqual(rounded, displayedLetterSpacing)) {
				return
			}
			setLetterSpacing(rounded)
		},
		[displayedLetterSpacing, setLetterSpacing],
	)

	const handleMetricKeyDown = useCallback(
		(
			event: KeyboardEvent<HTMLInputElement>,
			commitValue: (value: string) => void,
			resetValue: string,
			resetInputValue: (value: string) => void,
		) => {
			if (event.key === "Enter") {
				event.preventDefault()
				commitValue(event.currentTarget.value)
				event.currentTarget.blur()
				return
			}
			if (event.key === "Escape") {
				event.preventDefault()
				skipNextMetricBlurRef.current = true
				resetInputValue(resetValue)
				event.currentTarget.blur()
			}
		},
		[],
	)

	const handleRichTextDecorationChange = useCallback(
		(value: string) => {
			const nextValue = (value || "none") as RichTextDecorationValue
			setUnderline(nextValue === "underline")
			setStrikethrough(nextValue === "strikethrough")
		},
		[setStrikethrough, setUnderline],
	)
	const handleRichTextListTypeChange = useCallback(
		(value: string) => {
			const nextValue = (value || "none") as RichTextListValue
			setListType(nextValue === "none" ? null : (nextValue as TextListTypeValue))
		},
		[setListType],
	)
	const handleOpenChange = useCallback((nextOpen: boolean) => {
		if (!nextOpen && isInteractingInsidePopoverRef.current) {
			return
		}
		setOpen(nextOpen)
	}, [])
	const handlePopoverPointerDownCapture = useCallback(
		(event: PointerEvent<HTMLDivElement>) => {
			isInteractingInsidePopoverRef.current = true
			window.setTimeout(() => {
				isInteractingInsidePopoverRef.current = false
			}, 0)
			if (shouldAllowNativeFocus(event.target)) {
				return
			}
			const activeElement = document.activeElement
			if (
				activeElement instanceof HTMLElement &&
				event.currentTarget.contains(activeElement)
			) {
				activeElement.blur()
			}
			event.preventDefault()
			requestAnimationFrame(() => {
				restoreSelection()
			})
		},
		[restoreSelection],
	)
	// const handleRichTextCaseChange = useCallback((value: string) => {}, [])
	// const handleRichTextWidthChange = useCallback((value: string) => {}, [])

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<div>
					<IconButton className={styles.triggerButton}>
						<SlidersHorizontal size={16} />
						<span className={styles.buttonText}>
							{t("elementTools.shapeStyle.advanced", "高级")}
						</span>
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent
				className={styles.popoverContent}
				align="start"
				onOpenAutoFocus={(event) => {
					event.preventDefault()
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					restoreSelection()
				}}
				onPointerDownCapture={handlePopoverPointerDownCapture}
			>
				<div className={styles.textAdvanced}>
					<div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<div className={styles.inputContainer}>
								<LineHeight className={styles.inputIcon} size={16} />
								<NumberStepperInput
									step={0.1}
									min={0.1}
									stepBaseValue={displayedLineHeight ?? DEFAULT_TEXT_LINE_HEIGHT}
									inputClassName={classNames(styles.input, styles.metricInput)}
									value={lineHeightInputValue}
									placeholder={autoMetricPlaceholder}
									formatValue={(value) =>
										formatTypographyMetricForInput(
											value,
											TYPOGRAPHY_DECIMAL_PLACES,
										)
									}
									onValueChange={(value) => {
										const nextValue = sanitizeMetricInput(value)
										setLineHeightInputValue(nextValue)
									}}
									onStepValueChange={(value) => {
										const nextValue = sanitizeMetricInput(value)
										setLineHeightInputValue(nextValue)
										if (isCompleteMetricInput(nextValue)) {
											commitLineHeight(nextValue)
										}
									}}
									onBlur={() => {
										if (skipNextMetricBlurRef.current) {
											skipNextMetricBlurRef.current = false
											return
										}
										commitLineHeight(lineHeightInputValue)
									}}
									onKeyDown={(event) =>
										handleMetricKeyDown(
											event,
											commitLineHeight,
											formatMetricInputValue(displayedLineHeight),
											setLineHeightInputValue,
										)
									}
								/>
							</div>
						</div>
						<div className={styles.textAdvancedGroupItem}>
							<div className={styles.inputContainer}>
								<WordSpacing className={styles.inputIcon} size={16} />
								<NumberStepperInput
									step={10}
									min={0}
									stepBaseValue={
										displayedLetterSpacing ?? DEFAULT_TEXT_LETTER_SPACING
									}
									inputClassName={classNames(styles.input, styles.metricInput)}
									value={letterSpacingInputValue}
									placeholder={autoMetricPlaceholder}
									formatValue={(value) =>
										formatTypographyMetricForInput(
											value,
											TYPOGRAPHY_DECIMAL_PLACES,
										)
									}
									onValueChange={(value) => {
										const nextValue = sanitizeMetricInput(value)
										setLetterSpacingInputValue(nextValue)
									}}
									onStepValueChange={(value) => {
										const nextValue = sanitizeMetricInput(value)
										setLetterSpacingInputValue(nextValue)
										if (isCompleteMetricInput(nextValue)) {
											commitLetterSpacing(nextValue)
										}
									}}
									onBlur={() => {
										if (skipNextMetricBlurRef.current) {
											skipNextMetricBlurRef.current = false
											return
										}
										commitLetterSpacing(letterSpacingInputValue)
									}}
									onKeyDown={(event) =>
										handleMetricKeyDown(
											event,
											commitLetterSpacing,
											formatMetricInputValue(displayedLetterSpacing),
											setLetterSpacingInputValue,
										)
									}
								/>
							</div>
						</div>
					</div>

					<div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								value={displayedDecoration}
								onValueChange={handleRichTextDecorationChange}
								className={styles.toggleGroup}
							>
								{RICH_TEXT_DECORATION_OPTIONS.map((option) => {
									const Icon = option.icon
									const isActive = option.value === displayedDecoration
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
								value={displayedListType}
								onValueChange={handleRichTextListTypeChange}
								className={styles.toggleGroup}
							>
								{RICH_TEXT_LIST_OPTIONS.map((option) => {
									const Icon = option.icon
									const isActive = option.value === displayedListType
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

					{/* <div className={styles.textAdvancedGroup}>
						<div className={styles.textAdvancedGroupItem}>
							<ToggleGroup
								type="single"
								onValueChange={handleRichTextCaseChange}
								className={styles.toggleGroup}
							>
								{RICH_TEXT_CASE_OPTIONS.map((option, index) => {
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
								onValueChange={handleRichTextWidthChange}
								className={styles.toggleGroup}
							>
								{RICH_TEXT_WIDTH_OPTIONS.map((option, index) => {
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
					</div> */}
				</div>
			</PopoverContent>
		</Popover>
	)
}
