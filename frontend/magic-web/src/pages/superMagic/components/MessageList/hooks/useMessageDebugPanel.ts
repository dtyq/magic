import { useEffect, useRef, useState, type MouseEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { getMessageNodeKey } from "../helpers"

const REQUIRED_CLICKS = 5
const MAX_CLICK_INTERVAL_MS = 500
const MAX_SEQUENCE_DURATION_MS = 2000
// 兼顾语义控件与既有使用 cursor-pointer 的工具卡片，不拦截它们的原操作。
const INTERACTIVE_SELECTOR =
	"a, button, input, textarea, select, summary, audio, video, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='checkbox'], [role='menuitem'], [data-message-debug-ignore], .cursor-pointer"

export interface MessageDebugSnapshot {
	readonly json: string
	readonly sandboxId: string | undefined
}

interface ClickSequence {
	key: string
	container: HTMLDivElement
	firstClickAt: number
	lastClickAt: number
	count: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getSandboxId(node: Record<string, unknown>): string | undefined {
	const candidates = [node.sandbox_id, isRecord(node.debug) ? node.debug.sandbox_id : undefined]
	return candidates.find((value): value is string => typeof value === "string" && !!value.trim())
}

/** 列表只维护一次连击与一个快照；虚拟消息行卸载不影响已打开的面板。 */
export function useMessageDebugPanel({
	topicKey,
	enabled,
}: {
	topicKey: string
	enabled: boolean
}) {
	const { t } = useTranslation("super")
	const [snapshot, setSnapshot] = useState<MessageDebugSnapshot | null>(null)
	const sequenceRef = useRef<ClickSequence | null>(null)
	const cleanupRef = useRef<(() => void) | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const reset = useMemoizedFn(() => {
		if (timerRef.current !== null) clearTimeout(timerRef.current)
		timerRef.current = null
		sequenceRef.current = null
		cleanupRef.current?.()
		cleanupRef.current = null
	})

	const close = useMemoizedFn(() => {
		reset()
		setSnapshot(null)
	})

	useEffect(() => {
		close()
		return reset
	}, [topicKey, enabled, close, reset])

	const handleNodeClick = useMemoizedFn((value: unknown, event: MouseEvent<HTMLDivElement>) => {
		const target = event.target
		if (
			!enabled ||
			snapshot !== null ||
			event.button !== 0 ||
			event.detail === 0 ||
			event.defaultPrevented ||
			!(target instanceof Element) ||
			!event.currentTarget.contains(target) ||
			target.closest(INTERACTIVE_SELECTOR) ||
			!isRecord(value)
		) {
			reset()
			return
		}
		// 拖选后的普通单击不累计；原生双击、三击产生的选区仍允许完成五连击。
		if (event.detail <= 1 && window.getSelection()?.toString()) {
			reset()
			return
		}
		const key = getMessageNodeKey(value)
		if (!key) return
		const container = event.currentTarget
		const now = performance.now()
		let sequence = sequenceRef.current
		if (
			!sequence ||
			sequence.key !== key ||
			sequence.container !== container ||
			now - sequence.lastClickAt > MAX_CLICK_INTERVAL_MS ||
			now - sequence.firstClickAt > MAX_SEQUENCE_DURATION_MS
		) {
			reset()
			sequence = { key, container, firstClickAt: now, lastClickAt: now, count: 0 }
			sequenceRef.current = sequence
			const resetOutside = (pointerEvent: PointerEvent) => {
				const pointerTarget = pointerEvent.target
				if (
					!(pointerTarget instanceof Element) ||
					!container.contains(pointerTarget) ||
					pointerTarget.closest(INTERACTIVE_SELECTOR)
				)
					reset()
			}
			// 只在前四次点击之间监听；一次普通点击不会留下永久的全局监听。
			document.addEventListener("pointerdown", resetOutside, true)
			window.addEventListener("blur", reset)
			container.addEventListener("mouseleave", reset)
			container.addEventListener("pointercancel", reset)
			container.addEventListener("dragstart", reset)
			cleanupRef.current = () => {
				document.removeEventListener("pointerdown", resetOutside, true)
				window.removeEventListener("blur", reset)
				container.removeEventListener("mouseleave", reset)
				container.removeEventListener("pointercancel", reset)
				container.removeEventListener("dragstart", reset)
			}
		}
		sequence.count += 1
		sequence.lastClickAt = now
		if (sequence.count < REQUIRED_CLICKS) {
			if (timerRef.current !== null) clearTimeout(timerRef.current)
			timerRef.current = setTimeout(reset, MAX_CLICK_INTERVAL_MS)
			return
		}
		reset()
		try {
			// 与旧 Console 入口使用同一对象，打开后保留快照，不随流式回复重新序列化。
			const json = JSON.stringify(value, null, 2)
			setSnapshot({ json, sandboxId: getSandboxId(value) })
		} catch {
			magicToast.error(t("debug.message.serializeFailed"))
		}
	})

	return { snapshot, handleNodeClick, close }
}
