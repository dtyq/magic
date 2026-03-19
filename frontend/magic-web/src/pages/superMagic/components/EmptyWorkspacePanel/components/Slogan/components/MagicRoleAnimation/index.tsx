import outputMov from "./assets/index.mov"
import outputMp4 from "./assets/index.mp4"
import outputWebm from "./assets/index.webm"
import outputPoster from "./assets/index.png"
import { memo, useEffect, useRef } from "react"
import { useHover, useMount } from "ahooks"
import { isIos } from "@/utils/devices"

const MagicRoleAnimation = memo(() => {
	const ref = useRef<HTMLVideoElement>(null)
	const isHover = useHover(ref)
	const isPlaying = useRef(false)

	const playVideo = () => {
		const node = ref.current
		if (!node) return

		const playPromise = node.play()
		if (!playPromise) {
			isPlaying.current = true
			return
		}

		playPromise
			.then(() => {
				isPlaying.current = true
			})
			.catch((error: DOMException) => {
				if (error.name === "AbortError") return
				console.warn("MagicRoleAnimation play failed", error)
			})
	}

	useMount(() => {
		if (ref.current) {
			playVideo()

			ref.current.addEventListener("ended", () => {
				isPlaying.current = false
			})
		}
	})

	useEffect(() => {
		if (ref.current && isHover && !isPlaying.current) {
			playVideo()
		}
	}, [isHover])

	return (
		<video
			ref={ref}
			width={120}
			muted
			poster={outputPoster}
			draggable="false"
			onContextMenu={(e) => e.preventDefault()}
			playsInline
			disablePictureInPicture
			disableRemotePlayback
			preload="auto"
			className="[&::-webkit-media-controls-enclosure]:hidden [&::-webkit-media-controls-panel]:hidden [&::-webkit-media-controls]:hidden"
			style={{
				WebkitTapHighlightColor: "transparent",
			}}
		>
			<source src={outputWebm} type="video/webm" />
			<source src={outputMp4} type="video/mp4" />
			<source src={outputMov} type="video/quicktime" />
		</video>
	)
})

export default () => {
	if (isIos) {
		return <img className="h-[120px] w-auto" src={outputPoster} alt="MagicRoleAnimation" />
	}

	return <MagicRoleAnimation />
}
