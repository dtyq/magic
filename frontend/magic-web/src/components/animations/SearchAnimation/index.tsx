import type { ComponentProps } from "react"
import { memo } from "react"
import MagicSearchLoading from "./magic-search.json?raw"
import DotLottieWorkerReact from "@/components/other/DotLottieWorkerReact"

interface SearchAnimationProps extends ComponentProps<typeof DotLottieWorkerReact> {
	size: number
}

const url = URL.createObjectURL(new Blob([MagicSearchLoading], { type: "application/json" }))

const SearchAnimation = memo(({ size, ...props }: SearchAnimationProps) => {
	return (
		<DotLottieWorkerReact
			src={url}
			loop
			speed={0.5}
			autoplay
			style={{ width: size, height: size }}
			{...props}
		/>
	)
})

export default SearchAnimation
