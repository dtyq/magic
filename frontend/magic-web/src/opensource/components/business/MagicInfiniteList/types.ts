import type { ReactNode, CSSProperties } from "react"

// Base pagination response interface
export interface PaginationResponse<T = any> {
	items: T[]
	has_more: boolean
	page_token: string
}

// Data fetcher function type
export type DataFetcher<T = any, P = any> = (
	params?: P & { page_token?: string },
) => Promise<PaginationResponse<T>>

// Render item function type
export type RenderItem<T = any> = (item: T, index: number) => ReactNode

// Loading component type
export type LoadingComponent = ReactNode

// Empty component type
export type EmptyComponent = ReactNode

// MagicInfiniteList component props
export interface MagicInfiniteListProps<T = any, P = any> {
	// Data fetcher function
	dataFetcher: DataFetcher<T, P>

	// Item render function
	renderItem: RenderItem<T>

	// Additional fetch parameters
	fetchParams?: P

	// Initial data (for cache)
	initialData?: PaginationResponse<T> | null

	// Custom loading component
	loadingComponent?: LoadingComponent

	// Custom initial loading component (首次加载时显示，替代 loadingComponent)
	// 通常在移动端页面中传入骨架屏组件
	// PC端页面可以不传入，使用默认的 loadingComponent
	initialLoadingComponent?: LoadingComponent

	// Custom empty component
	emptyComponent?: EmptyComponent

	// Container styles
	className?: string
	style?: CSSProperties

	// Item styles
	itemClassName?: string
	itemStyle?: CSSProperties

	// Whether to use default item styles
	useDefaultItemStyles?: boolean

	// Scroll container ID
	scrollableTarget?: string

	// Auto fetch on mount
	autoFetch?: boolean

	// Item key extractor
	getItemKey?: (item: T, index: number) => string | number
}

// Hook state interface
export interface InfiniteDataState<T = any> {
	data: PaginationResponse<T> | undefined
	isLoading: boolean
	error: Error | null
}

// Hook return interface
export interface UseInfiniteDataReturn<T = any, P = any> {
	// Current data state
	data: PaginationResponse<T> | undefined

	// Loading state
	isLoading: boolean

	// Error state
	error: Error | null

	// Trigger data fetch
	fetchData: (params?: P & { page_token?: string }) => Promise<void>

	// Reset data
	reset: () => void

	// Refresh data (reset and fetch)
	refresh: () => Promise<void>
}
