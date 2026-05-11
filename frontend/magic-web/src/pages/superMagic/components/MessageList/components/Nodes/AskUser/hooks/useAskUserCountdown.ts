import { useEffect, useMemo, useState } from "react"
import { ASK_USER_TIME } from "@/pages/superMagic/components/MessageList/utils/askUserConstants"

function getRemainingMs(expiresAt?: number) {
	if (!expiresAt) return 0
	return Math.max(expiresAt * ASK_USER_TIME.msPerSecond - Date.now(), 0)
}

export function formatAskUserRemainingTime(remainingMs: number) {
	const totalSeconds = Math.max(Math.ceil(remainingMs / ASK_USER_TIME.msPerSecond), 0)
	const secondsPerHour = ASK_USER_TIME.secondsPerMinute * ASK_USER_TIME.minutesPerHour
	const hours = Math.floor(totalSeconds / secondsPerHour)
	const minutes = Math.floor((totalSeconds % secondsPerHour) / ASK_USER_TIME.secondsPerMinute)
	const seconds = totalSeconds % ASK_USER_TIME.secondsPerMinute

	return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":")
}

export function useAskUserCountdown({
	expiresAt,
	isActive,
}: {
	expiresAt?: number
	isActive: boolean
}) {
	const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(expiresAt))

	useEffect(() => {
		setRemainingMs(getRemainingMs(expiresAt))
	}, [expiresAt])

	useEffect(() => {
		if (!expiresAt || !isActive) return

		const timer = window.setInterval(() => {
			setRemainingMs(getRemainingMs(expiresAt))
		}, ASK_USER_TIME.countdownTickMs)

		return () => {
			window.clearInterval(timer)
		}
	}, [expiresAt, isActive])

	const isExpiredLocal = remainingMs <= 0

	return useMemo(
		() => ({
			remainingMs,
			remainingText: formatAskUserRemainingTime(remainingMs),
			isExpiredLocal,
		}),
		[isExpiredLocal, remainingMs],
	)
}
