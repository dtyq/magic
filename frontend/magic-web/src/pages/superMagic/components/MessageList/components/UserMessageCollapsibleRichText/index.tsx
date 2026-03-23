import { useMemoizedFn } from "ahooks"
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import RichTextComponent from "../Text/components/RichText"
import type { RichTextProps } from "../Text/components/RichText/types"

/** Expanded body: max height then scroll */
const USER_MESSAGE_EXPANDED_MAX = "max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden pr-0.5"
const USER_MESSAGE_FADE_H = "h-12"
/**
 * ~4 lines at RichText [&_p]:leading-[22px] (4 * 22px). Avoid line-clamp here:
 * PM mounts inside a flex root; line-clamp on parent is unreliable.
 */
const USER_MESSAGE_COLLAPSED_MAX_PX = 88
const USER_MESSAGE_COLLAPSED_CAP = "min-h-0 max-h-[5.5rem] overflow-hidden"

export interface UserMessageCollapsibleRichTextProps extends RichTextProps {
	/** Bottom fade gradient "from" (match parent bubble bg). */
	clampFadeFromClass?: string
}

function contentSignature(content: RichTextProps["content"]): string {
	if (content == null) return ""
	if (typeof content === "string") return content
	try {
		return JSON.stringify(content)
	} catch {
		return String(content)
	}
}

function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	return Boolean(
		target.closest(
			"a, button, [role='button'], input, textarea, .magic-mention, .mention-node-view",
		),
	)
}

export const UserMessageCollapsibleRichText = memo(function UserMessageCollapsibleRichText(
	props: UserMessageCollapsibleRichTextProps,
) {
	const { className, style, clampFadeFromClass = "from-card", ...richProps } = props
	const [isExpanded, setIsExpanded] = useState(false)
	const [isTruncatable, setIsTruncatable] = useState(false)
	const innerRef = useRef<HTMLDivElement>(null)
	const isExpandedRef = useRef(false)
	isExpandedRef.current = isExpanded

	const sig = useMemo(() => contentSignature(props.content), [props.content])

	const measureTruncation = useMemoizedFn(() => {
		const outer = innerRef.current
		if (!outer || isExpandedRef.current) return
		const inner = outer.firstElementChild as HTMLElement | undefined
		if (!inner) {
			setIsTruncatable(false)
			return
		}
		const next = inner.scrollHeight > USER_MESSAGE_COLLAPSED_MAX_PX + 1
		setIsTruncatable((prev) => (prev === next ? prev : next))
	})

	useLayoutEffect(() => {
		const el = innerRef.current
		if (!el || isExpanded) return

		measureTruncation()

		const ro = new ResizeObserver(() => {
			requestAnimationFrame(measureTruncation)
		})
		ro.observe(el)
		const inner = el.firstElementChild
		if (inner) ro.observe(inner)

		const mo = new MutationObserver(() => {
			requestAnimationFrame(measureTruncation)
		})
		mo.observe(el, { childList: true, subtree: true, characterData: true })

		return () => {
			ro.disconnect()
			mo.disconnect()
		}
	}, [sig, isExpanded, measureTruncation])

	useEffect(() => {
		if (isExpanded) return
		let innerRaf = 0
		const outerRaf = requestAnimationFrame(() => {
			innerRaf = requestAnimationFrame(measureTruncation)
		})
		const t0 = window.setTimeout(measureTruncation, 0)
		const t1 = window.setTimeout(measureTruncation, 120)
		return () => {
			cancelAnimationFrame(outerRaf)
			cancelAnimationFrame(innerRaf)
			window.clearTimeout(t0)
			window.clearTimeout(t1)
		}
	}, [sig, isExpanded, measureTruncation])

	const focusPanel = useMemoizedFn(() => {
		const el = innerRef.current
		if (!el) return
		window.requestAnimationFrame(() => {
			el.focus({ preventScroll: true })
		})
	})

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		if (!isTruncatable || isExpanded) return
		if (isInteractiveTarget(e.target)) return
		setIsExpanded(true)
		focusPanel()
	})

	const handleKeyDown = useMemoizedFn((e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!isTruncatable || isExpanded) return
		if (e.key !== "Enter" && e.key !== " ") return
		e.preventDefault()
		setIsExpanded(true)
		focusPanel()
	})

	const handleBlur = useMemoizedFn((e: React.FocusEvent<HTMLDivElement>) => {
		if (!isExpandedRef.current || !isTruncatable) return
		const next = e.relatedTarget
		if (next instanceof Node && innerRef.current?.contains(next)) return
		setIsExpanded(false)
	})

	return (
		<div className={cn("relative w-full min-w-0", className)} style={style}>
			<div className="relative">
				<div
					ref={innerRef}
					tabIndex={isTruncatable ? 0 : undefined}
					role={isTruncatable ? "group" : undefined}
					aria-expanded={isTruncatable ? isExpanded : undefined}
					className={cn(
						!isExpanded && USER_MESSAGE_COLLAPSED_CAP,
						isExpanded && USER_MESSAGE_EXPANDED_MAX,
						isTruncatable &&
							!isExpanded &&
							cn(
								"cursor-grab outline-none focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing",
								"[&>div]:!cursor-grab [&_a]:cursor-pointer [&_button]:cursor-pointer",
								"[&_.magic-mention]:cursor-pointer [&_.mention-node-view]:cursor-pointer",
							),
						isTruncatable &&
							isExpanded &&
							"outline-none focus-visible:ring-1 focus-visible:ring-ring",
					)}
					data-testid="user-message-collapsible-text"
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
				>
					<RichTextComponent {...richProps} />
				</div>
				{!isExpanded && isTruncatable && (
					<div
						className={cn(
							"pointer-events-none absolute inset-x-0 bottom-0",
							USER_MESSAGE_FADE_H,
							"bg-gradient-to-t to-transparent",
							clampFadeFromClass,
						)}
						aria-hidden
					/>
				)}
			</div>
		</div>
	)
})
