import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react"
import { DotLottieReact as DotLottieReactOriginal } from "@lottiefiles/dotlottie-react"

function DotLottieReact({ ...props }: DotLottieReactProps) {
	return <DotLottieReactOriginal {...props} />
}

export default DotLottieReact
