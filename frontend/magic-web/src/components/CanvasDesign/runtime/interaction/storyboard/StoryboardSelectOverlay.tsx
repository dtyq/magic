import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDown } from "lucide-react"
import { useEffect, useRef, type CSSProperties } from "react"
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
} from "../../../ui/primitives/shadcn/select"
import type { StoryboardSelectGroup, StoryboardSelectOption } from "./StoryboardFieldOverlayHost"
import styles from "./StoryboardSelectOverlay.module.css"

export interface StoryboardSelectCanvasOutsidePointer {
	clientX: number
	clientY: number
	target: EventTarget | null
}

interface StoryboardSelectOverlayProps {
	ariaLabel: string
	value: string
	options: StoryboardSelectOption[]
	groups?: StoryboardSelectGroup[]
	fontSize: number
	horizontalPadding: number
	suffixGap: number
	suffixIconSize: number
	modelIconUrl?: string
	modelIconSize?: number
	modelIconGap?: number
	borderRadius: number
	onCommit: (value: string) => void
	onCancel: () => void
	/**
	 * Select 打开时会 disableOutsidePointerEvents，画布收不到指针。
	 * 点在画布/字段 overlay 区域时走此回调，由宿主 commit 后按坐标激活目标控件。
	 */
	onCanvasOutsidePointer: (point: StoryboardSelectCanvasOutsidePointer) => void
}

type StoryboardSelectCssVariables = CSSProperties & {
	"--storyboard-select-font-size": string
	"--storyboard-select-horizontal-padding": string
	"--storyboard-select-suffix-gap": string
	"--storyboard-select-suffix-size": string
	"--storyboard-select-model-icon-size": string
	"--storyboard-select-model-icon-gap": string
	"--storyboard-select-border-radius": string
}

type StoryboardOptionCssVariables = CSSProperties & {
	"--storyboard-option-icon"?: string
	"--storyboard-option-preview-left"?: string
	"--storyboard-option-preview-width"?: string
	"--storyboard-option-preview-height"?: string
}

/** Select 打开时 body 常为 pointer-events:none，event.target 可能不是 canvas，需结合坐标判断。 */
function isPointerOverCanvasSurface(
	clientX: number,
	clientY: number,
	target: EventTarget | null,
): boolean {
	if (target instanceof Element) {
		if (
			target.closest(".konvajs-content") ||
			target.closest('[data-canvas-ui="storyboard-field-overlay"]')
		) {
			return true
		}
	}
	const content = document.querySelector(".konvajs-content")
	if (!content) return false
	const rect = content.getBoundingClientRect()
	return (
		clientX >= rect.left &&
		clientX <= rect.right &&
		clientY >= rect.top &&
		clientY <= rect.bottom
	)
}

export function StoryboardSelectOverlay({
	ariaLabel,
	value,
	options,
	groups,
	fontSize,
	horizontalPadding,
	suffixGap,
	suffixIconSize,
	modelIconUrl,
	modelIconSize,
	modelIconGap,
	borderRadius,
	onCommit,
	onCancel,
	onCanvasOutsidePointer,
}: StoryboardSelectOverlayProps) {
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const triggerStyle: StoryboardSelectCssVariables = {
		opacity: 0,
		"--storyboard-select-font-size": `${fontSize}px`,
		"--storyboard-select-horizontal-padding": `${horizontalPadding}px`,
		"--storyboard-select-suffix-gap": `${suffixGap}px`,
		"--storyboard-select-suffix-size": `${suffixIconSize}px`,
		"--storyboard-select-model-icon-size": `${modelIconSize ?? 0}px`,
		"--storyboard-select-model-icon-gap": `${modelIconGap ?? 0}px`,
		"--storyboard-select-border-radius": `${borderRadius}px`,
	}

	useEffect(() => {
		try {
			triggerRef.current?.focus({ preventScroll: true })
		} catch {
			triggerRef.current?.focus()
		}
	}, [])

	const renderOption = (option: StoryboardSelectOption, indented = false) => {
		const optionStyle: StoryboardOptionCssVariables = {}
		if (option.icon) optionStyle["--storyboard-option-icon"] = `url(${option.icon})`
		if (option.preview) {
			optionStyle["--storyboard-option-preview-left"] =
				`${10 + (24 - option.preview.iconWidth) / 2}px`
			optionStyle["--storyboard-option-preview-width"] = `${option.preview.iconWidth}px`
			optionStyle["--storyboard-option-preview-height"] = `${option.preview.iconHeight}px`
		}

		return (
			<SelectItem
				key={option.value}
				value={option.value}
				className={styles.optionItem}
				data-storyboard-option-icon={option.icon ? "true" : undefined}
				data-storyboard-option-size={option.preview ? "true" : undefined}
				data-storyboard-option-indented={indented ? "true" : undefined}
				style={optionStyle}
			>
				<span
					className={styles.optionLabel}
					title={option.label}
					data-storyboard-option-secondary={option.secondaryLabel}
				>
					{option.label}
				</span>
			</SelectItem>
		)
	}

	return (
		<div data-canvas-ui-component style={{ width: "100%", height: "100%" }}>
			<Select value={value} open onValueChange={onCommit}>
				<SelectPrimitive.Trigger
					ref={triggerRef}
					aria-label={ariaLabel}
					className={styles.trigger}
					style={triggerStyle}
				>
					{modelIconUrl ? (
						<img
							data-storyboard-select-model-icon
							className={styles.modelIcon}
							src={modelIconUrl}
							alt=""
						/>
					) : null}
					<span data-storyboard-select-value className={styles.value}>
						<SelectPrimitive.Value />
					</span>
					<span data-storyboard-select-suffix aria-hidden className={styles.suffix}>
						<ChevronDown className={styles.suffixIcon} />
					</span>
				</SelectPrimitive.Trigger>
				<SelectContent
					position="popper"
					align="end"
					sideOffset={4}
					style={{ minWidth: "var(--radix-select-trigger-width)", maxWidth: 320 }}
					// 同控件再点 trigger：不走 onOpenChange(false) 关闭。
					// Select 打开时 disableOutsidePointerEvents，画布收不到事件；
					// 点画布区域时交给 onCanvasOutsidePointer（按坐标切换/关闭目标控件）。
					onEscapeKeyDown={() => onCancel()}
					onPointerDownOutside={(event) => {
						const original = event.detail.originalEvent
						if (
							isPointerOverCanvasSurface(
								original.clientX,
								original.clientY,
								original.target,
							)
						) {
							event.preventDefault()
							onCanvasOutsidePointer({
								clientX: original.clientX,
								clientY: original.clientY,
								target: original.target,
							})
							return
						}
						onCancel()
					}}
				>
					{groups?.map((group) => (
						<SelectGroup key={group.id}>
							<SelectLabel
								className={styles.groupLabel}
								data-storyboard-select-group-label
							>
								<span className={styles.groupLabelContent}>
									{group.icon ? (
										<img
											className={styles.groupLabelIcon}
											src={group.icon}
											alt=""
										/>
									) : null}
									<span>{group.label}</span>
								</span>
							</SelectLabel>
							{group.options.map((option) => renderOption(option, true))}
						</SelectGroup>
					))}
					{groups?.length ? null : options.map((option) => renderOption(option))}
				</SelectContent>
			</Select>
		</div>
	)
}
