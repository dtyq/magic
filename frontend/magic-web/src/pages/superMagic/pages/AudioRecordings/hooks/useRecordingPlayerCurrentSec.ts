import { useEffect, useState, type RefObject } from "react"

/**
 * Tracks audio currentTime at RAF cadence while playing so waveform progress stays smooth.
 * Isolates high-frequency updates from the parent detail page render tree.
 */
export function useRecordingPlayerCurrentSec(
	audioRef: RefObject<HTMLAudioElement>,
	playing: boolean,
	fallbackSec = 0,
) {
	const [currentSec, setCurrentSec] = useState(fallbackSec)

	/** Sync external position (e.g. seeking or audio URL reset) while paused. */
	useEffect(() => {
		if (playing) return
		setCurrentSec(fallbackSec)
	}, [fallbackSec, playing])

	/** Run 60fps RAF loop to track currentTime smoothly during playback without parent re-renders. */
	useEffect(() => {
		if (!playing) return

		let raf = 0
		const loop = () => {
			const audio = audioRef.current
			// Skip reading stale currentTime while the media decoder is actively seeking
			if (audio && !audio.seeking) {
				setCurrentSec(audio.currentTime)
			}
			raf = requestAnimationFrame(loop)
		}
		raf = requestAnimationFrame(loop)
		return () => cancelAnimationFrame(raf)
	}, [audioRef, playing])

	/** Sync waveform position after programmatic seeks on the audio element. */
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return

		function handleSeeked() {
			if (audio) {
				setCurrentSec(audio.currentTime)
			}
		}

		audio.addEventListener("seeked", handleSeeked)
		return () => audio.removeEventListener("seeked", handleSeeked)
	}, [audioRef])

	return currentSec
}
