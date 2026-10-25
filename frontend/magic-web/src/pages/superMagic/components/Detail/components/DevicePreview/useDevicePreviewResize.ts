import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { MIN_PREVIEW_DIMENSION, MAX_PREVIEW_DIMENSION } from "./constants"
import type { DeviceDimensions, DevicePreviewConfig, DevicePreviewControls } from "./types"

type ResizeDirection = "width" | "height" | "both"
interface ResizeSession {
	config: DevicePreviewConfig
	identity: string
	scale: number
	x: number
	y: number
	centerX: number
	top: number
	landscape: boolean
	pointerId: number
	target: HTMLDivElement
	direction: ResizeDirection
}

export function useDevicePreviewResize({
	config,
	setConfig,
	active,
	identity,
	scale,
	containerRef,
	spaceRef,
}: DevicePreviewControls & {
	scale: number
	containerRef: RefObject<HTMLDivElement>
	spaceRef: RefObject<HTMLDivElement>
}) {
	const sessionRef = useRef<ResizeSession | null>(null)
	const [session, setSession] = useState<ResizeSession | null>(null)
	const frameRef = useRef<number | null>(null)
	const pendingRef = useRef<DeviceDimensions | null>(null)
	const flush = useMemoizedFn(() => {
		frameRef.current = null
		const current = sessionRef.current
		const dimensions = pendingRef.current
		pendingRef.current = null
		if (current && dimensions && current.identity === identity && active)
			setConfig({ ...current.config, ...dimensions, preset: "custom" })
	})
	const finish = useMemoizedFn((cancel: boolean) => {
		const current = sessionRef.current
		if (!current) return
		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
		frameRef.current = null
		if (!cancel) flush()
		pendingRef.current = null
		sessionRef.current = null
		setSession(null)
		if (cancel && current.identity === identity) setConfig(current.config)
		if (current.target.hasPointerCapture(current.pointerId))
			current.target.releasePointerCapture(current.pointerId)
	})
	useEffect(() => {
		if (!active || scale <= 0 || sessionRef.current?.identity !== identity) finish(true)
	}, [active, identity, scale, finish])
	useEffect(() => {
		if (!session) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				event.stopPropagation()
				finish(true)
			}
		}
		document.addEventListener("keydown", onKeyDown, true)
		return () => document.removeEventListener("keydown", onKeyDown, true)
	}, [session, finish])
	const dispose = useMemoizedFn(() => {
		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
		const current = sessionRef.current
		sessionRef.current = null
		if (!current) return
		// 加载或错误分支卸载工作区时撤销尚未完成的拖动，不把旧文件配置带到新文件。
		if (current.identity === identity) setConfig(current.config)
		if (current.target.hasPointerCapture(current.pointerId))
			current.target.releasePointerCapture(current.pointerId)
	})
	useEffect(() => dispose, [dispose])

	function begin(event: PointerEvent<HTMLDivElement>, direction: ResizeDirection) {
		const container = containerRef.current,
			space = spaceRef.current
		if (!active || scale <= 0 || event.button !== 0 || !container || !space) return
		event.preventDefault()
		event.stopPropagation()
		const rect = space.getBoundingClientRect(),
			host = container.getBoundingClientRect()
		const current: ResizeSession = {
			config,
			identity,
			scale,
			x: event.clientX,
			y: event.clientY,
			centerX: rect.left - host.left + container.scrollLeft + rect.width / 2,
			top: rect.top - host.top + container.scrollTop,
			landscape: config.width > config.height,
			pointerId: event.pointerId,
			target: event.currentTarget,
			direction,
		}
		sessionRef.current = current
		event.currentTarget.setPointerCapture(event.pointerId)
		setSession(current)
	}
	function move(event: PointerEvent<HTMLDivElement>) {
		const current = sessionRef.current
		if (!current || current.pointerId !== event.pointerId) return
		const clamp = (value: number) =>
			Math.max(MIN_PREVIEW_DIMENSION, Math.min(MAX_PREVIEW_DIMENSION, Math.round(value)))
		// 固定中心后，总宽必须增加两倍指针位移；左右各增一半，右边缘才能跟手。
		pendingRef.current = {
			width:
				current.direction === "height"
					? current.config.width
					: clamp(
							current.config.width +
								(2 * (event.clientX - current.x)) / current.scale,
						),
			height:
				current.direction === "width"
					? current.config.height
					: clamp(current.config.height + (event.clientY - current.y) / current.scale),
		}
		if (frameRef.current === null) frameRef.current = requestAnimationFrame(flush)
	}
	function handleProps(direction: ResizeDirection) {
		return {
			onPointerDown: (event: PointerEvent<HTMLDivElement>) => begin(event, direction),
			onPointerMove: move,
			onPointerUp: () => finish(false),
			onPointerCancel: () => finish(true),
			onLostPointerCapture: () => finish(true),
		}
	}
	return { session, handleProps }
}
