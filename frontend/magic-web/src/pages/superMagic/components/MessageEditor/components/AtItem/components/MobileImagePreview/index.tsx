import { lazy, Suspense, forwardRef } from "react"
import type { MobileImagePreviewRef, MobileImagePreviewProps } from "./types"

// Lazy load the component
const MobileImagePreviewLazyBase = lazy(() => import("./MobileImagePreviewComponent"))

// Wrap lazy component with forwardRef to support ref forwarding
const MobileImagePreviewLazy = forwardRef<MobileImagePreviewRef, MobileImagePreviewProps>(
	(props, ref) => {
		return <MobileImagePreviewLazyBase {...props} ref={ref} />
	},
)

// Export lazy version
export const MobileImagePreview = MobileImagePreviewLazy

// Re-export types
export type { MobileImagePreviewProps, MobileImagePreviewRef } from "./types"

// Global instance for functional usage
let globalPreviewRef: MobileImagePreviewRef | null = null

// Provider component to be mounted at the Super route root
export function MobileImagePreviewProvider() {
	return (
		<Suspense fallback={null}>
			<MobileImagePreviewLazy
				ref={(ref) => {
					globalPreviewRef = ref
				}}
			/>
		</Suspense>
	)
}

// Functional API
export const showMobileImagePreview = (options: {
	src?: string
	alt?: string
	file_id?: string
	file?: File
}) => {
	if (globalPreviewRef) {
		globalPreviewRef.show(options)
	} else {
		console.warn(
			"MobileImagePreviewProvider not mounted. Please add <MobileImagePreviewProvider /> to the Super route root layout.",
		)
	}
}

export const hideMobileImagePreview = () => {
	if (globalPreviewRef) {
		globalPreviewRef.hide()
	}
}

export default MobileImagePreview
