import { Suspense, type ReactNode, type ComponentType } from "react"
import { useBoolean } from "ahooks"

interface LazyWrapperProps {
	/** The lazy loaded component */
	component: ComponentType<{ children?: ReactNode; [key: string]: unknown }>
	/** Props to pass to the lazy component */
	componentProps?: Record<string, unknown>
	/** The fallback content that will be shown before lazy loading */
	children: ReactNode
	/** Function to preload the component */
	onPreload?: () => void
}

/**
 * A wrapper component that handles lazy loading with preload optimization
 * Preloads on mouse enter and initializes the lazy component on click
 */
function DropdownLazyLoadWrapper({
	component: Component,
	componentProps = {},
	children,
	onPreload,
}: LazyWrapperProps) {
	const [initialized, { setTrue: setInitializedTrue }] = useBoolean(false)

	return (
		<div onMouseEnter={onPreload} onClick={setInitializedTrue} className="w-full">
			{initialized ? (
				<Suspense fallback={children}>
					<Component {...componentProps}>{children}</Component>
				</Suspense>
			) : (
				children
			)}
		</div>
	)
}

export default DropdownLazyLoadWrapper
