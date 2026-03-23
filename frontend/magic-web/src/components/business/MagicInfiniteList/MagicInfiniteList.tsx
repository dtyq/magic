import { memo, useMemo, useRef } from "react"
import { Flex, List } from "antd"
import { nanoid } from "nanoid"
import InfiniteScroll from "react-infinite-scroll-component"

// Types
import type { MagicInfiniteListProps } from "./types"

// Styles
import { useStyles } from "./styles"

// Hooks
import { useInfiniteData } from "./hooks/useInfiniteData"

// Components
import MagicEmpty from "../../base/MagicEmpty"
import MagicButton from "../../base/MagicButton"
import { useTranslation } from "react-i18next"
import { Spinner } from "../../shadcn-ui/spinner"
import { ScrollArea } from "../../shadcn-ui/scroll-area"

/**
 * MagicInfiniteList - Generic infinite scroll list component
 *
 * @param props - Component properties
 * @returns JSX.Element
 */
function MagicInfiniteList<T = unknown, P = Record<string, unknown>>({
	dataFetcher,
	renderItem,
	fetchParams,
	initialData,
	loadingComponent,
	initialLoadingComponent,
	emptyComponent,
	className,
	style,
	itemClassName,
	itemStyle,
	useDefaultItemStyles = true,
	scrollableTarget,
	autoFetch = true,
	getItemKey,
}: MagicInfiniteListProps<T, P>) {
	const { styles } = useStyles()
	const scrollId = useRef<string>(scrollableTarget || nanoid())
	const { t } = useTranslation("interface")
	const hasExternalScrollTarget = Boolean(scrollableTarget)

	// Use infinite data hook
	const { data, isLoading, error, fetchData, refresh } = useInfiniteData(dataFetcher, {
		autoFetch,
		initialParams: fetchParams,
		keyExtractor: getItemKey ? (item: T) => getItemKey(item, 0) : undefined,
		initialData, // 传入初始缓存数据
	})

	// Handle load more
	const handleLoadMore = () => {
		if (data?.page_token) {
			fetchData({
				...fetchParams,
				page_token: data.page_token,
			} as P & { page_token: string })
		}
	}

	// Default loading component
	const defaultLoadingComponent = useMemo(() => {
		return (
			<Flex justify="center" align="center" className={styles.loadingContainer}>
				<div className={styles.loadingSpinner}>
					<Spinner className="animate-spin" size={20} />
				</div>
			</Flex>
		)
	}, [styles.loadingContainer, styles.loadingSpinner])

	// Default empty component
	const defaultEmptyComponent = useMemo(() => {
		return (
			<div className={styles.emptyContainer}>
				<MagicEmpty />
			</div>
		)
	}, [styles.emptyContainer])

	// Error state
	if (error) {
		return (
			<div className={styles.errorContainer}>
				<div className={styles.errorMessage}>Failed to load data: {error?.message}</div>
				<MagicButton type="link" onClick={refresh} className={styles.retryButton}>
					{t("common.retry")}
				</MagicButton>
			</div>
		)
	}

	// Initial loading state
	// 优先使用 initialLoadingComponent（通常是骨架屏），否则使用 loadingComponent
	if (!data?.items?.length && isLoading) {
		if (!initialData) return initialLoadingComponent
		return loadingComponent || defaultLoadingComponent
	}

	// Empty state
	if (!data?.items?.length && !isLoading) {
		return emptyComponent || defaultEmptyComponent
	}

	const listContent = (
		<InfiniteScroll
			dataLength={data?.items?.length || 0}
			next={handleLoadMore}
			hasMore={data?.has_more || false}
			style={{ width: "100%", overflow: "visible" }}
			loader={
				data && data?.items.length > 0 && isLoading
					? loadingComponent || defaultLoadingComponent
					: null
			}
			endMessage={null}
			scrollableTarget={scrollId.current}
		>
			<List
				dataSource={data?.items}
				renderItem={(item, index) => {
					// Combine default styles with custom styles
					let combinedClassName = ""

					if (useDefaultItemStyles) {
						combinedClassName = itemClassName
							? `${styles.defaultItem} ${itemClassName}`
							: styles.defaultItem
					} else {
						combinedClassName = itemClassName || ""
					}

					return (
						<List.Item
							key={getItemKey ? getItemKey(item, index) : index}
							className={combinedClassName}
							style={itemStyle}
						>
							{renderItem(item, index)}
						</List.Item>
					)
				}}
			/>
		</InfiniteScroll>
	)

	if (hasExternalScrollTarget) {
		return (
			<div className={`${styles.externalContainer} ${className || ""}`} style={style}>
				<div className={styles.externalList}>{listContent}</div>
			</div>
		)
	}

	return (
		<div className={`${styles.container} ${className || ""}`} style={style}>
			<ScrollArea className={styles.list} viewportId={scrollId.current}>
				{listContent}
			</ScrollArea>
		</div>
	)
}

const MagicInfiniteListMemo = memo(MagicInfiniteList) as typeof MagicInfiniteList & {
	displayName?: string
}

MagicInfiniteListMemo.displayName = "MagicInfiniteList"

export default MagicInfiniteListMemo
