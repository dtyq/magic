import type { ReactNode, ForwardedRef } from "react"
import { forwardRef, memo, useImperativeHandle, useMemo, useRef } from "react"
import { IconLoader, IconUser } from "@tabler/icons-react"
import InfiniteScroll from "react-infinite-scroll-component"
import { useMemoizedFn, useSize } from "ahooks"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/context/AppearanceProvider"
import { Empty } from "@/components/ui/empty"
import { Spin } from "@/components/ui/spin"

export interface InfiniteListProps<T> {
	/** 通用数据列表类型 */
	list?: T[]
	/** 是否还有更多数据 */
	hasMore?: boolean
	/** 是否正在加载 */
	isLoading?: boolean
	/** 加载更多数据的函数 */
	loadMore?: () => void
	/** 自定义渲染每个列表项的函数 */
	renderItem: (item: T) => ReactNode
	/** 列表为空时显示的内容，默认为 Empty 组件 */
	emptyComponent?: ReactNode
	/** 加载中显示的内容 */
	loadingComponent?: ReactNode
	/** 没有更多数据时显示的内容 */
	endMessageComponent?: ReactNode
	/** 列表网格配置 */
	grid?: {
		column?: number
	}
	/** 包裹列表的容器类名 */
	wrapperClassName?: string
	/** 列表项类名 */
	itemClassName?: string
	/** 列表项高度 */
	itemHeight?: number
}

export interface InfiniteListRef {
	getPageSize: () => number
}

const InfiniteList = forwardRef(function InfiniteList<T>(
	props: InfiniteListProps<T>,
	ref: ForwardedRef<InfiniteListRef>,
) {
	const {
		list,
		hasMore = false,
		isLoading,
		loadMore,
		renderItem,
		emptyComponent,
		loadingComponent,
		endMessageComponent,
		wrapperClassName,
		itemClassName,
		itemHeight = 60,
		grid,
	} = props

	const { getLocale } = useAppearance()
	const locale = getLocale()

	const scrollRef = useRef<HTMLDivElement>(null)
	const scrollSize = useSize(scrollRef)

	const defaultLoader = useMemo(
		() => (
			<div className="flex items-center justify-center gap-1 py-2.5 text-xs text-muted-foreground">
				<IconLoader size={20} className="animate-spin" />
				<div>{locale.loading}</div>
			</div>
		),
		[locale],
	)

	const defaultEmptyComponent = (
		<Empty image={<IconUser size={24} />} description={locale.noData} />
	)

	// 获取列数的函数
	const getColumnCount = useMemoizedFn(() => {
		if (!grid) {
			return 1 // 如果没有设置 grid，则为单列
		}

		// 根据 grid 的 column 属性获取列数
		if (grid.column) {
			return grid.column
		}

		return 1
	})

	const getPageSize = useMemoizedFn(() => {
		if (scrollSize?.height) {
			const column = getColumnCount()
			const size = Math.floor(scrollSize.height / itemHeight)
			return size % column === 0 ? size : size + 1
		}
		return 10
	})

	useImperativeHandle(
		ref,
		() => ({
			getPageSize,
		}),
		[getPageSize],
	)

	if (isLoading) {
		return (
			<div className={cn("flex h-full items-center justify-center", wrapperClassName)}>
				<Spin spinning />
			</div>
		)
	}

	return (
		<div
			className={cn(
				"h-full overflow-x-hidden overflow-y-auto",
				list?.length === 0 && "flex items-center justify-center overflow-hidden",
				wrapperClassName,
			)}
			id="scrollableDiv"
			ref={scrollRef}
		>
			{!isLoading && list?.length === 0 && (emptyComponent || defaultEmptyComponent)}
			{list && list?.length > 0 && (
				<InfiniteScroll
					next={loadMore || (() => {})}
					hasMore={hasMore}
					loader={loadingComponent || defaultLoader}
					endMessage={endMessageComponent}
					dataLength={list.length}
					scrollableTarget="scrollableDiv"
					className="[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					<div className={cn("h-full overflow-auto")}>
						{list.map((item, index) => (
							<div key={index} className={cn("p-0", itemClassName)}>
								{renderItem(item)}
							</div>
						))}
					</div>
				</InfiniteScroll>
			)}
		</div>
	)
})

export default memo(InfiniteList) as <T>(props: InfiniteListProps<T>) => JSX.Element
