// Main component
export { default } from "./MagicInfiniteList"

// Types
export type {
	PaginationResponse,
	DataFetcher,
	RenderItem,
	LoadingComponent,
	EmptyComponent,
	MagicInfiniteListProps,
	InfiniteDataState,
	UseInfiniteDataReturn,
} from "./types"

// Hooks
export { useInfiniteData } from "./hooks/useInfiniteData"

// Styles
export { useStyles } from "./styles"

// Examples
export { default as BasicUsage } from "./examples/BasicUsage"
export { default as StyledUsage } from "./examples/StyledUsage"
