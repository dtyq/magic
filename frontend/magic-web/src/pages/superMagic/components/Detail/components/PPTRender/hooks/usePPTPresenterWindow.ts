import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

export type PPTPresenterOpenResult = "opened" | "fallback" | "cancelled" | "blocked"

type PresenterPhase = "idle" | "starting" | "presenting"

interface PresenterSession {
	id: number
	cancel: () => void
	cancelled: Promise<null>
}

interface NativeFullscreenRequest {
	id: number
	target: HTMLElement
	promise: Promise<boolean>
	exit?: Promise<void>
}

/** The Window Management API fields used by the presenter. */
export interface PPTPresenterScreen {
	left?: number
	top?: number
	width?: number
	height?: number
	availLeft?: number
	availTop?: number
	availWidth?: number
	availHeight?: number
	isPrimary?: boolean
	label?: string
}

interface ScreenDetailsLike {
	currentScreen: PPTPresenterScreen
	screens: PPTPresenterScreen[]
}

type WindowWithManagement = Window & {
	getScreenDetails?: () => Promise<ScreenDetailsLike>
}

type PresentationTarget = HTMLElement & {
	requestFullscreen: (
		options?: FullscreenOptions & { screen?: PPTPresenterScreen },
	) => Promise<void>
}

function bounds(screen: PPTPresenterScreen) {
	return {
		left: screen.availLeft ?? screen.left ?? 0,
		top: screen.availTop ?? screen.top ?? 0,
		width: screen.availWidth ?? screen.width ?? 1280,
		height: screen.availHeight ?? screen.height ?? 720,
	}
}

// Run in the companion realm so the browser can delegate its click activation.
// No slide HTML or user-authored strings are interpolated into this script.
const CONSOLE_GESTURES = `<script>document.addEventListener('click', function(event) {
 const item = event.target.closest('[data-ppt-screen-index]');
 if (!item || !window.opener) return;
 window.opener.postMessage({type:'ppt-presenter:screen', index:Number(item.dataset.pptScreenIndex)},
  {targetOrigin:window.opener.location.origin, delegate:'fullscreen'});
}, true);</script>`

async function exitPresenterFullscreen(target: HTMLElement | null) {
	const exitFullscreen = document.exitFullscreen
	// React clears DOM refs before passive cleanup; equal empty values do not own fullscreen.
	if (!target || document.fullscreenElement !== target || typeof exitFullscreen !== "function")
		return
	// Keep synchronous API failures in the same Promise error path as rejected exits.
	await exitFullscreen.call(document)
}

/** Fullscreen the existing slide first: opening an audience popup consumes the gesture.
 * The browser permits a companion window after a targeted fullscreen request. */
export function usePPTPresenterWindow(targetRef: RefObject<HTMLElement>) {
	const { t } = useTranslation("super")
	const popupRef = useRef<Window | null>(null)
	const generation = useRef(0)
	const sessionRef = useRef<PresenterSession | null>(null)
	const nativeRequestRef = useRef<NativeFullscreenRequest | null>(null)
	const phaseRef = useRef<PresenterPhase>("idle")
	const [phase, setPhase] = useState<PresenterPhase>("idle")
	const [consoleContainer, setConsoleContainer] = useState<HTMLElement | null>(null)
	const [isFallbackOnly, setFallbackOnly] = useState(false)
	const [screens, setScreens] = useState<PPTPresenterScreen[]>([])
	const [selectedScreen, setSelectedScreen] = useState<number | null>(null)
	const changePhase = useCallback((next: PresenterPhase) => {
		phaseRef.current = next
		setPhase(next)
	}, [])
	const exitTargetFullscreen = useCallback(
		async (target: HTMLElement | null) => {
			if (!target || document.fullscreenElement !== target) return
			try {
				await exitPresenterFullscreen(target)
			} catch {
				magicToast.error(t("ppt.presenter.exitFailed"))
			}
		},
		[t],
	)
	const hasPendingNativeRequest = useCallback(() => nativeRequestRef.current !== null, [])
	const requestFullscreen = useCallback(
		(target: PresentationTarget, screen: PPTPresenterScreen, id: number) => {
			const fullscreen = target.requestFullscreen({ screen })
			// 逻辑取消不能取消浏览器 API：保留原生占用，直到晚到结果及其退出处理都结束。
			// 例：取消后 Promise 仍未完成 → 禁止第二次请求；晚到成功 → 只退出该舞台。
			const request: NativeFullscreenRequest = {
				id,
				target,
				promise: fullscreen
					.then(
						async () => {
							if (id !== generation.current) {
								// Undo a late fullscreen only if another session has not taken ownership.
								await (request.exit ?? exitTargetFullscreen(target))
								return false
							}
							return document.fullscreenElement === target
						},
						() => false,
					)
					.finally(async () => {
						if (request.exit) await request.exit
						if (nativeRequestRef.current === request) nativeRequestRef.current = null
					}),
			}
			nativeRequestRef.current = request
			return request.promise
		},
		[exitTargetFullscreen],
	)
	const close = useCallback(() => {
		generation.current++
		sessionRef.current?.cancel()
		sessionRef.current = null
		popupRef.current?.close()
		popupRef.current = null
		setConsoleContainer(null)
		changePhase("idle")
		const target = targetRef.current
		if (target && document.fullscreenElement === target) {
			if (nativeRequestRef.current) {
				nativeRequestRef.current.exit ??= exitTargetFullscreen(target)
			} else {
				// 退出也是原生操作；完成前不能让下一次启动与这次退出交叉。
				const exiting = exitTargetFullscreen(target)
				const request: NativeFullscreenRequest = {
					id: generation.current,
					target,
					promise: exiting
						.then(() => false)
						.finally(() => {
							if (nativeRequestRef.current === request)
								nativeRequestRef.current = null
						}),
				}
				nativeRequestRef.current = request
			}
		}
	}, [targetRef, changePhase, exitTargetFullscreen])

	const open = useCallback(async (): Promise<PPTPresenterOpenResult> => {
		if (phaseRef.current === "starting") {
			close()
			return "cancelled"
		}
		if (hasPendingNativeRequest()) return "blocked"
		if (phaseRef.current === "presenting") return "opened"
		const target = targetRef.current as PresentationTarget | null
		const getScreenDetails = (window as WindowWithManagement).getScreenDetails
		if (
			!target?.requestFullscreen ||
			typeof document.exitFullscreen !== "function" ||
			!getScreenDetails ||
			(window.screen as Screen & { isExtended?: boolean }).isExtended !== true
		)
			return "fallback"
		const operation = ++generation.current
		let cancel: () => void = () => undefined
		const cancelled = new Promise<null>((resolve) => {
			cancel = () => resolve(null)
		})
		const session: PresenterSession = {
			id: operation,
			cancel,
			cancelled,
		}
		sessionRef.current = session
		changePhase("starting")
		let popup: Window | null = null
		try {
			// Permission must be requested before any activation-consuming browser API.
			const details = await Promise.race([getScreenDetails.call(window), session.cancelled])
			if (operation !== generation.current) return "cancelled"
			if (!details) return "cancelled"
			const external = details.screens.findIndex(
				(screen) =>
					screen !== details.currentScreen &&
					(screen.left !== details.currentScreen.left ||
						screen.top !== details.currentScreen.top),
			)
			if (external < 0) return "fallback"
			const home = bounds(details.currentScreen)
			// Do not await fullscreen before window.open: both belong to the same click.
			const fullscreen = requestFullscreen(target, details.screens[external], operation)
			try {
				popup = window.open(
					"",
					"_blank",
					`popup,left=${home.left},top=${home.top},width=${home.width},height=${home.height}`,
				)
				popupRef.current = popup
			} catch {
				// Fullscreen still succeeds when a companion window is unavailable.
			}
			setScreens(details.screens)
			setSelectedScreen(external)
			try {
				if (popup) {
					const doc = popup.document
					doc.open()
					doc.write(
						'<!doctype html><html><head><meta charset="utf-8"></head><body><main id="ppt-presenter-console"></main>' +
							CONSOLE_GESTURES +
							"</body></html>",
					)
					doc.close()
					doc.title = t("ppt.presenter.title")
					// React portals share state, but the companion document needs its own styles and theme.
					doc.documentElement.className = document.documentElement.className
					doc.documentElement.style.cssText = document.documentElement.style.cssText
					for (const style of document.querySelectorAll('style, link[rel="stylesheet"]'))
						doc.head.appendChild(style.cloneNode(true))
					const root = doc.getElementById("ppt-presenter-console")
					if (!root) throw new Error("Presenter console container is missing")
					Object.assign(doc.body.style, { margin: "0", overflow: "hidden" })
					Object.assign(root.style, {
						height: "100vh",
						padding: "16px",
						boxSizing: "border-box",
						background: "#333",
						display: "flex",
						flexDirection: "column",
					})
					setConsoleContainer(root)
					popup.focus()
				}
			} catch {
				popup?.close()
				popupRef.current = null
				setConsoleContainer(null)
			}
			if (!popupRef.current) magicToast.warning(t("ppt.presenter.consoleUnavailable"))
			// 控制台先挂载。取消只结束本地等待，原生请求由 requestFullscreen 持续观察。
			const entered = await Promise.race([fullscreen, session.cancelled])
			if (operation !== generation.current) return "cancelled"
			if (!entered) {
				close()
				setFallbackOnly(true)
				return "fallback"
			}
			if (popupRef.current?.closed) {
				close()
				return "cancelled"
			}
			changePhase("presenting")
			return "opened"
		} catch {
			// A rejected permission/fullscreen request can outlive a closed or replaced session.
			if (operation !== generation.current) {
				popup?.close()
				return "cancelled"
			}
			popup?.close()
			popupRef.current = null
			setConsoleContainer(null)
			// A companion setup failure must not undo a successful audience fullscreen.
			if (document.fullscreenElement === target) {
				changePhase("presenting")
				return "opened"
			}
			setFallbackOnly(true)
			return "fallback"
		} finally {
			if (operation === generation.current && phaseRef.current === "starting") {
				sessionRef.current = null
				changePhase("idle")
			}
		}
	}, [targetRef, t, close, changePhase, requestFullscreen, hasPendingNativeRequest])

	const moveToScreen = useCallback(
		async (index: number) => {
			const target = targetRef.current as PresentationTarget | null
			if (
				!target ||
				!screens[index] ||
				phaseRef.current !== "presenting" ||
				hasPendingNativeRequest()
			)
				return false
			const operation = generation.current
			try {
				const entered = await requestFullscreen(target, screens[index], operation)
				if (!entered || operation !== generation.current) return false
				setSelectedScreen(index)
				const companionScreen = screens.find((_, candidate) => candidate !== index)
				if (companionScreen && popupRef.current) {
					const rect = bounds(companionScreen)
					popupRef.current.moveTo(rect.left, rect.top)
					popupRef.current.resizeTo(rect.width, rect.height)
				}
				return true
			} catch {
				return false
			}
		},
		[targetRef, screens, requestFullscreen, hasPendingNativeRequest],
	)
	useEffect(() => {
		if (phase === "idle") return
		const onFullscreenChange = () => {
			if (
				phaseRef.current === "presenting" &&
				document.fullscreenElement !== targetRef.current
			)
				close()
		}
		const onEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return
			const element = event.target as Element | null
			if (
				element?.nodeType === 1 &&
				element.closest("input, textarea, select, [contenteditable], [role=menuitem]")
			)
				return
			event.preventDefault()
			close()
		}
		const onScreenRequest = (event: MessageEvent) => {
			if (
				event.source !== popupRef.current ||
				event.origin !== window.location.origin ||
				event.data?.type !== "ppt-presenter:screen" ||
				!Number.isInteger(event.data.index)
			)
				return
			void moveToScreen(event.data.index)
		}
		window.addEventListener("message", onScreenRequest)
		const timer = window.setInterval(() => {
			if (popupRef.current?.closed) close()
		}, 500)
		document.addEventListener("fullscreenchange", onFullscreenChange)
		const companion = consoleContainer?.ownerDocument.defaultView
		window.addEventListener("keydown", onEscape)
		companion?.addEventListener("keydown", onEscape)
		window.addEventListener("pagehide", close)
		return () => {
			window.clearInterval(timer)
			window.removeEventListener("message", onScreenRequest)
			document.removeEventListener("fullscreenchange", onFullscreenChange)
			window.removeEventListener("keydown", onEscape)
			companion?.removeEventListener("keydown", onEscape)
			window.removeEventListener("pagehide", close)
		}
	}, [phase, consoleContainer, close, targetRef, moveToScreen])
	useEffect(() => () => close(), [close])

	return {
		moveToScreen,
		isOpen: phase === "presenting",
		isStarting: phase === "starting",
		hasPendingNativeRequest,
		isFallbackOnly,
		screens,
		selectedScreen,
		open,
		close,
		consoleContainer,
	}
}
