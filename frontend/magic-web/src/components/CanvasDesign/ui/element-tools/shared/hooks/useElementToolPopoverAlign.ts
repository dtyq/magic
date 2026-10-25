import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type RefCallback,
} from "react"

type PopoverAlign = "start" | "end"

interface UseElementToolPopoverAlignOptions {
	open: boolean
	floatingRef: MutableRefObject<HTMLDivElement | null>
}

/** 工具栏弹层：上方右对齐；碰撞翻转到下方后改为左对齐。 */
export default function useElementToolPopoverAlign(options: UseElementToolPopoverAlignOptions): {
	align: PopoverAlign
	contentRef: RefCallback<HTMLDivElement>
} {
	const { open, floatingRef } = options
	const [align, setAlign] = useState<PopoverAlign>("end")
	const observerRef = useRef<MutationObserver | null>(null)

	const syncAlignFromSide = useCallback((node: HTMLDivElement) => {
		const nextAlign: PopoverAlign = node.dataset.side === "bottom" ? "start" : "end"
		setAlign((currentAlign) => (currentAlign === nextAlign ? currentAlign : nextAlign))
	}, [])

	const contentRef = useCallback<RefCallback<HTMLDivElement>>(
		(node) => {
			observerRef.current?.disconnect()
			observerRef.current = null
			floatingRef.current = node
			if (!node) return

			syncAlignFromSide(node)
			if (typeof MutationObserver === "undefined") return

			const observer = new MutationObserver(() => syncAlignFromSide(node))
			observer.observe(node, { attributes: true, attributeFilter: ["data-side"] })
			observerRef.current = observer
		},
		[floatingRef, syncAlignFromSide],
	)

	useEffect(() => {
		if (!open) setAlign("end")
	}, [open])

	useEffect(
		() => () => {
			observerRef.current?.disconnect()
		},
		[],
	)

	return { align, contentRef }
}
