import type { PropsWithChildren } from "react"
import { memo, Suspense } from "react"
import MagicSpin from "../MagicSpin"

const LoadingFallback = memo(({ children }: PropsWithChildren) => {
	return (
		<Suspense
			fallback={
				<MagicSpin
					style={{
						height: "100%",
						width: "100%",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
					}}
				/>
			}
		>
			{children}
		</Suspense>
	)
})

export default LoadingFallback
