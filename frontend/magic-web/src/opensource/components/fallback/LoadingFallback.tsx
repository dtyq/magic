import { Suspense, type PropsWithChildren } from "react"
import FullSpin from "../other/FullSpin"

function LoadingFallback({ children }: PropsWithChildren) {
	return <Suspense fallback={<FullSpin />}>{children}</Suspense>
}

export default LoadingFallback
