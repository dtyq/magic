import type { ChangeEvent, MouseEvent } from "react"
import { memo, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

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
	className,
	disabled = false,
}: MobileBottomSearchBarProps) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [isInputFocused, setIsInputFocused] = useState(false)
	const showClearButton =
		!disabled && shouldShowClearButton(value, isInputFocused, clearButtonVisibility)

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
		onValueChange("")
		setIsInputFocused(false)
		inputRef.current?.blur()
	}

	return (
		<div
			className={cn(
				// Full-width shell fill so padding below the card pills matches page + GlobalSafeArea.
				"shrink-0 bg-mobile-background px-[10px] pb-3 pt-2",
				className,
			)}
			data-testid={`${testIdPrefix}-root`}
		>
			<div className="flex items-center gap-2">
				<div
					className="flex h-[44px] min-w-0 flex-1 items-center gap-1 rounded-full border border-border bg-card px-3 shadow-mobile-dock-surface"
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
						className="flex size-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-mobile-dock-surface"
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
