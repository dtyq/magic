import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import type { Editor } from "@/infrastructure/editors/tiptap/core"
import type { WechatMessage } from "../../extensions/wechat-chat-history/types"

interface Anchor {
	index: number
	position?: number
	progress: number
	bottom: boolean
}
type Side = "left" | "right"

export function useChatScroll(
	editor: Editor | null,
	left: RefObject<HTMLDivElement>,
	right: RefObject<HTMLDivElement>,
	messages: WechatMessage[],
	openId: string | null,
	scrollRequest: number,
) {
	const [synced, setSynced] = useState(true)
	const hasMessages = messages.length > 0
	const lastSide = useRef<Side>("left")
	const anchor = useRef<Anchor>({ index: 0, progress: 0, bottom: true })
	const expected = useRef<Partial<Record<Side, number>>>({})
	const previewRows = useRef(new Map<string, HTMLElement>())
	useLayoutEffect(() => {
		const rows = new Map<string, HTMLElement>()
		right.current?.querySelectorAll<HTMLElement>("[data-chat-message]").forEach((row) => {
			if (row.dataset.chatMessage) rows.set(row.dataset.chatMessage, row)
		})
		previewRows.current = rows
	}, [right, messages])
	const point = useMemoizedFn((side: Side, index: number): number => {
		const viewport = side === "left" ? left.current : right.current
		const message = messages[index]
		if (!viewport || !message || !editor || editor.isDestroyed) return 0
		const top = viewport.getBoundingClientRect().top - viewport.scrollTop
		if (side === "right")
			return (previewRows.current.get(message.id)?.getBoundingClientRect().top ?? top) - top
		const dom = editor.view.domAtPos(Math.min(message.from, editor.state.doc.content.size)).node
		return (
			((dom instanceof Element ? dom : dom.parentElement)?.getBoundingClientRect().top ??
				top) - top
		)
	})
	const read = useMemoizedFn((side: Side): Anchor => {
		const viewport = side === "left" ? left.current : right.current
		if (!viewport) return anchor.current
		// 消息位置有序，滚动时只二分查找当前消息；大量聊天不能逐条查询 DOM、测量整份文档。
		let low = 0
		let high = messages.length
		while (low < high) {
			const middle = Math.floor((low + high) / 2)
			if (point(side, middle) <= viewport.scrollTop + 1) low = middle + 1
			else high = middle
		}
		const index = Math.max(0, low - 1)
		const start = point(side, index)
		const end = index + 1 < messages.length ? point(side, index + 1) : viewport.scrollHeight
		return {
			index,
			position: messages[index]?.from,
			progress: Math.max(
				0,
				Math.min(1, (viewport.scrollTop - start) / Math.max(1, end - start)),
			),
			bottom: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 2,
		}
	})
	const write = useMemoizedFn((side: Side, value: Anchor) => {
		const viewport = side === "left" ? left.current : right.current
		if (!viewport || !hasMessages) return
		let next = viewport.scrollHeight
		if (!value.bottom) {
			let low = 0
			let high = messages.length
			if (value.position !== undefined) {
				while (low < high) {
					const middle = Math.floor((low + high) / 2)
					if (messages[middle].to < value.position) low = middle + 1
					else high = middle
				}
			}
			const index = Math.min(
				value.position === undefined ? value.index : low,
				Math.max(0, messages.length - 1),
			)
			const start = point(side, index)
			const end = index + 1 < messages.length ? point(side, index + 1) : viewport.scrollHeight
			next = start + (end - start) * value.progress
		}
		const target = Math.max(0, Math.min(next, viewport.scrollHeight - viewport.clientHeight))
		expected.current[side] = target
		viewport.scrollTop = target
	})
	const onScroll = useMemoizedFn((side: Side) => {
		const viewport = side === "left" ? left.current : right.current
		if (!viewport) return
		const target = expected.current[side]
		if (target !== undefined && Math.abs(viewport.scrollTop - target) < 2) {
			delete expected.current[side]
			return
		}
		delete expected.current[side]
		lastSide.current = side
		anchor.current = read(side)
		if (synced) write(side === "left" ? "right" : "left", anchor.current)
	})
	const toggle = useMemoizedFn((value: boolean) => {
		setSynced(value)
		if (value && hasMessages) {
			anchor.current = read(lastSide.current)
			write(lastSide.current === "left" ? "right" : "left", anchor.current)
		}
	})
	useEffect(() => {
		if (!editor) return
		const mapAnchor = ({
			transaction,
		}: {
			transaction: import("@/infrastructure/editors/tiptap/pm-state").Transaction
		}) => {
			if (transaction.docChanged && anchor.current.position !== undefined)
				anchor.current.position = transaction.mapping.map(anchor.current.position)
		}
		editor.on("transaction", mapAnchor)
		return () => {
			editor.off("transaction", mapAnchor)
		}
	}, [editor])
	useEffect(() => {
		if (!openId) return
		// 空导入显示教程，应从第一步开始阅读；有消息时才定位最新消息并联动两侧。
		if (!hasMessages) {
			if (right.current) right.current.scrollTop = 0
			return
		}
		const frame = requestAnimationFrame(() => {
			anchor.current = { index: 0, progress: 1, bottom: true }
			write("left", anchor.current)
			write("right", anchor.current)
		})
		return () => cancelAnimationFrame(frame)
	}, [openId, scrollRequest, hasMessages, left, right, write])
	useEffect(() => {
		if (!openId || !hasMessages) return
		const leftViewport = left.current
		const rightViewport = right.current
		const leftScroll = () => onScroll("left")
		const rightScroll = () => onScroll("right")
		leftViewport?.addEventListener("scroll", leftScroll)
		rightViewport?.addEventListener("scroll", rightScroll)
		// 媒体加载和编辑只改变高度时保持消息内的阅读位置；程序滚动通过 expected 避免往返循环。
		const resize = new ResizeObserver(() => {
			if (synced) {
				write("left", anchor.current)
				write("right", anchor.current)
			}
		})
		if (leftViewport?.firstElementChild) resize.observe(leftViewport.firstElementChild)
		if (rightViewport?.firstElementChild) resize.observe(rightViewport.firstElementChild)
		return () => {
			resize.disconnect()
			leftViewport?.removeEventListener("scroll", leftScroll)
			rightViewport?.removeEventListener("scroll", rightScroll)
		}
	}, [openId, synced, hasMessages, messages, left, right, onScroll, write])
	return { synced, toggle }
}
