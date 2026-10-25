import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import type { PPTBuildController } from "./usePPTBuildPlayback"

/** A step's reveal animation (250 ms fade) finishes before the next automatic step starts. */
const AUTO_STEP_SETTLE_MS = 250
const AUTO_STEP_RETRY_MS = 300

/** Consume a build before calling the existing guarded page navigation. */
export function usePPTBuildNavigation(options: {
	getPageKey: () => string
	isPresenting: () => boolean
	hasBuilds?: () => boolean
	canNavigate: () => boolean
	changePage: (direction: "prev" | "next") => Promise<void>
	jumpPage: (index: number) => Promise<boolean>
	firstPage: () => Promise<boolean>
}) {
	const controllers = useRef(new Map<string, PPTBuildController>())
	const startAtEnd = useRef(false)
	const presenting = options.isPresenting()
	useEffect(() => {
		if (!presenting) startAtEnd.current = false
	}, [presenting])
	// Automatic steps only continue forward: going back stops the chain until the next click.
	const autoEligible = useRef(true)
	const [progress, setProgress] = useState<{
		key: string
		step: number
		total: number
		delays?: Array<number | null>
	}>({ key: "", step: 0, total: 0 })
	const register = useMemoizedFn((key: string, controller: PPTBuildController | null) => {
		if (controller) controllers.current.set(key, controller)
		else controllers.current.delete(key)
		if (key === options.getPageKey())
			setProgress({
				key,
				step: controller?.state.step ?? 0,
				total: controller?.state.total ?? 0,
				delays: controller?.state.delays,
			})
	})
	const changeSlide = useMemoizedFn(async (direction: "prev" | "next") => {
		autoEligible.current = direction === "next"
		if (!options.isPresenting()) {
			startAtEnd.current = false
			await options.changePage(direction)
			return
		}
		if (!options.canNavigate()) return
		if (options.isPresenting()) {
			const controller = controllers.current.get(options.getPageKey())
			if (!controller && options.hasBuilds?.()) return
			if (controller) {
				const { step, total } = controller.state
				const target = step + (direction === "next" ? 1 : -1)
				if (target >= 0 && target <= total && target !== step) {
					await controller.setStep(target, direction === "next")
					return
				}
			}
		}
		const before = options.getPageKey()
		startAtEnd.current = direction === "prev"
		await options.changePage(direction)
		if (before === options.getPageKey()) startAtEnd.current = false
	})
	const handleJumpToPage = useMemoizedFn(async (index: number) => {
		autoEligible.current = true
		startAtEnd.current = false
		const key = options.getPageKey()
		const navigated = await options.jumpPage(index)
		if (navigated && key === options.getPageKey() && options.isPresenting())
			await controllers.current.get(key)?.setStep(0)
	})
	const goToFirstSlide = useMemoizedFn(async () => {
		autoEligible.current = true
		startAtEnd.current = false
		const key = options.getPageKey()
		const navigated = await options.firstPage()
		if (navigated && key === options.getPageKey() && options.isPresenting())
			await controllers.current.get(key)?.setStep(0)
	})
	// Steps marked to play by themselves advance after their delay; any click or page change
	// changes `progress` and so cancels and reschedules this timer.
	useEffect(() => {
		if (!presenting || progress.key !== options.getPageKey() || !autoEligible.current) return
		const delay = progress.delays?.[progress.step]
		if (progress.step >= progress.total || delay === undefined || delay === null) return
		let timer = 0
		const fire = () => {
			// Navigation can be briefly locked (page transition); wait it out instead of stalling.
			if (!options.canNavigate()) {
				timer = window.setTimeout(fire, AUTO_STEP_RETRY_MS)
				return
			}
			void changeSlide("next")
		}
		timer = window.setTimeout(fire, AUTO_STEP_SETTLE_MS + delay)
		return () => window.clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [presenting, progress])
	return {
		acceptsMessage: (event: MessageEvent) =>
			controllers.current.get(options.getPageKey())?.acceptsMessage(event) ?? false,
		register,
		changeSlide,
		handleJumpToPage,
		goToFirstSlide,
		startAtEnd,
		progress:
			options.isPresenting() && progress.key === options.getPageKey()
				? progress
				: { step: 0, total: 0 },
	}
}
