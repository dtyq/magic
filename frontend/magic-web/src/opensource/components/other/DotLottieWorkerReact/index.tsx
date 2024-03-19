import type { DotLottieWorkerReactProps } from "@lottiefiles/dotlottie-react"
import { DotLottieWorkerReact as DotLottieWorkerReactOriginal } from "@lottiefiles/dotlottie-react"

function DotLottieWorkerReact({ ...props }: DotLottieWorkerReactProps) {
	return <DotLottieWorkerReactOriginal {...props} />
}

export default DotLottieWorkerReact
