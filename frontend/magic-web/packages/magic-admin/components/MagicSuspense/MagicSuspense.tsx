import type { SuspenseProps } from "react"
import { Suspense } from "react"
import MagicSpin from "../MagicSpin"

interface MagicSuspenseProps extends SuspenseProps {
	style?: React.CSSProperties
}

const MagicSuspense = ({ children, style, ...props }: MagicSuspenseProps) => {
	return (
		<Suspense
			fallback={
				<MagicSpin
					spinning
					style={{
						height: "100%",
						width: "100%",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						...style,
					}}
				/>
			}
			{...props}
		>
			{children}
		</Suspense>
	)
}

export default MagicSuspense
