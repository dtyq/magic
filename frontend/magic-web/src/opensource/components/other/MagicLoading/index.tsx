import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react"
import { memo, useEffect, useRef } from "react"
import loadingJson from "./loading.json?raw"
import DotLottieReact from "@/opensource/components/other/DotLottieReact"

const url = URL.createObjectURL(new Blob([loadingJson], { type: "application/json" }))

// DotLottie instance interface for better type safety
interface DotLottieInstance {
	play: () => void
	pause: () => void
	stop: () => void
	setFrame: (frame: number) => void
	addEventListener: (event: string, callback: (data?: any) => void) => void
	removeEventListener: (event: string, callback: (data?: any) => void) => void
	currentFrame: number
	totalFrames: number
	isPlaying: boolean
	isPaused: boolean
	isStopped: boolean
}

interface MagicLoadingProps extends DotLottieReactProps {
	section?: boolean
	size?: number
	// Animation playback control parameters
	currentFrame?: number
	onDotLottieRef?: (dotLottie: DotLottieInstance | null) => void
}

const MagicLoading = memo(function MagicLoading({
	section,
	currentFrame,
	onDotLottieRef,
	...props
}: MagicLoadingProps) {
	const dotLottieRef = useRef<DotLottieInstance | null>(null)

	// Handle dotLottie instance callback
	const handleDotLottieRef = (dotLottie: any) => {
		dotLottieRef.current = dotLottie
		onDotLottieRef?.(dotLottie)
	}

	// Control animation frame when currentFrame changes
	useEffect(() => {
		if (dotLottieRef.current && typeof currentFrame === "number") {
			dotLottieRef.current.setFrame(currentFrame)
		}
	}, [currentFrame])

	return (
		<DotLottieReact
			src={section ? url : url}
			loop
			speed={section ? 2 : 1}
			autoplay
			dotLottieRefCallback={handleDotLottieRef}
			{...props}
		/>
	)
})

export default MagicLoading
export type { MagicLoadingProps, DotLottieInstance }
