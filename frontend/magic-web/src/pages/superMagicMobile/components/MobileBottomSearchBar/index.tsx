import type { ChangeEvent, MouseEvent } from "react"
import { memo, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"

import { cn } from "@/utils/cn"

import type { MobileBottomSearchBarProps } from "./types"

/**
 * 根据页面期望的交互模式决定是否展示清除按钮，避免不同列表页重复维护同一套焦点逻辑。
 */
function shouldShowClearButton(
	value: string,
	isInputFocused: boolean,
	clearButtonVisibility: MobileBottomSearchBarProps["clearButtonVisibility"],
) {
	if (clearButtonVisibility === "value-only") return value.trim().length > 0

	return isInputFocused || value.length > 0
}

/**
 * 统一移动端底部浮动搜索条的视觉与交互，让不同页面只保留受控搜索值和占位文案。
 */
const MobileBottomSearchBar = memo(function MobileBottomSearchBar({
	value,
	placeholder,
	clearAriaLabel,
	onValueChange,
	testIdPrefix,
	clearButtonVisibility = "focus-or-value",
	layout = "bottom",
	onDismiss,
	autoFocus = false,
	onCompositionStart,
	onCompositionEnd,
	className,
	disabled = false,
	variant = "default",
	currentResult = 0,
	totalResults = 0,
	closeAriaLabel,
	previousAriaLabel,
	nextAriaLabel,
	onClose,
	onPrevious,
	onNext,
}: MobileBottomSearchBarProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [isInputFocused, setIsInputFocused] = useState(false)
	const showClearButton =
		!disabled &&
		(onDismiss != null || shouldShowClearButton(value, isInputFocused, clearButtonVisibility))

	/** Toolbar inline mode focuses the input immediately when search mode opens */
	useEffect(() => {
		if (!autoFocus) return
		inputRef.current?.focus()
	}, [autoFocus])

	/**
	 * 输入变化始终回传给页面层，确保该组件保持纯受控模式，便于本地搜索和远端搜索共用。
	 */
	function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
		onValueChange(event.target.value)
	}

	/**
	 * 记录焦点态，用于还原「聚焦即显示取消按钮」的移动端搜索交互。
	 */
	function handleFocus() {
		setIsInputFocused(true)
	}

	/**
	 * 输入失焦后仅在没有关键字时退出活跃态，避免输入值仍存在时清除按钮闪烁消失。
	 */
	function handleBlur() {
		if (value.length > 0) return

		setIsInputFocused(false)
	}

	/**
	 * 使用 mouse down 拦截默认失焦顺序，保证清除关键字和主动 blur 的行为稳定一致。
	 */
	function handleClearMouseDown(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		if (onDismiss) {
			onDismiss()
			return
		}
		onValueChange("")
		setIsInputFocused(false)
		inputRef.current?.blur()
	}

	/** Clears only the recording-content query while keeping the search toolbar open. */
	function handleRecordingQueryClear(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		onValueChange("")
		inputRef.current?.focus()
	}

	const shellClassName =
		layout === "inline" ? "shrink-0" : "shrink-0 bg-mobile-background px-[10px] pb-3 pt-2"

	if (variant === "recording-content") {
		const navigationDisabled = disabled || totalResults === 0
		return (
			<div
				className={cn(
					"fixed inset-x-[10px] bottom-3 z-30 shrink-0 pb-[env(safe-area-inset-bottom)]",
					className,
				)}
				data-testid={`${testIdPrefix}-root`}
			>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onClose}
						className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-magic-floating-action"
						aria-label={closeAriaLabel}
						data-testid={`${testIdPrefix}-close`}
					>
						<X className="size-[18px] text-foreground" style={{ strokeWidth: 2 }} />
					</button>

					<div
						className="flex h-[44px] min-w-0 flex-1 items-center gap-1 rounded-full border border-border bg-card px-3 shadow-magic-floating-action"
						data-testid={`${testIdPrefix}-field`}
					>
						<Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
						<input
							ref={inputRef}
							type="text"
							value={value}
							onChange={handleValueChange}
							onFocus={handleFocus}
							onBlur={handleBlur}
							onCompositionStart={onCompositionStart}
							onCompositionEnd={onCompositionEnd}
							placeholder={placeholder}
							disabled={disabled}
							className="min-w-0 flex-1 border-none bg-transparent text-[14px] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
							data-testid={`${testIdPrefix}-input`}
						/>
						{value ? (
							<button
								type="button"
								onMouseDown={handleRecordingQueryClear}
								className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
								aria-label={clearAriaLabel}
								data-testid={`${testIdPrefix}-clear`}
							>
								<X className="size-3.5" strokeWidth={2.5} />
							</button>
						) : null}
						<span
							className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
							data-testid={`${testIdPrefix}-result-count`}
						>
							{currentResult}/{totalResults}
						</span>
					</div>

					<button
						type="button"
						onClick={onPrevious}
						disabled={navigationDisabled}
						className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-magic-floating-action"
						aria-label={previousAriaLabel}
						data-testid={`${testIdPrefix}-previous`}
					>
						<ChevronUp className="size-[18px]" style={{ strokeWidth: 2 }} />
					</button>
					<button
						type="button"
						onClick={onNext}
						disabled={navigationDisabled}
						className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-magic-floating-action"
						aria-label={nextAriaLabel}
						data-testid={`${testIdPrefix}-next`}
					>
						<ChevronDown className="size-[18px]" style={{ strokeWidth: 2 }} />
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className={cn(shellClassName, className)} data-testid={`${testIdPrefix}-root`}>
			<div className="flex items-center gap-2">
				{/* Downward floating shadow matches prototype; dock upward shadow would darken ScrollEdgeFade above. */}
				<div
					className="flex h-[44px] min-w-0 flex-1 items-center gap-1 rounded-full border border-border bg-card px-3 shadow-magic-floating-action"
					data-testid={`${testIdPrefix}-field`}
				>
					<Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
					<input
						ref={inputRef}
						type="text"
						value={value}
						onChange={handleValueChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onCompositionStart={onCompositionStart}
						onCompositionEnd={onCompositionEnd}
						placeholder={placeholder}
						disabled={disabled}
						className="min-w-0 flex-1 border-none bg-transparent text-[14px] leading-5 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
						data-testid={`${testIdPrefix}-input`}
					/>
				</div>

				{showClearButton ? (
					<button
						type="button"
						onMouseDown={handleClearMouseDown}
						className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-magic-floating-action"
						aria-label={clearAriaLabel}
						data-testid={`${testIdPrefix}-clear`}
					>
						<X className="size-[18px] text-foreground" strokeWidth={2.5} />
					</button>
				) : null}
			</div>
		</div>
	)
})

export default MobileBottomSearchBar
export type { MobileBottomSearchBarProps }
