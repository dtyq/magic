import { forwardRef, useImperativeHandle, useMemo, useRef, type ReactNode } from "react"
import { useMemoizedFn, useSize } from "ahooks"
import { observer } from "mobx-react-lite"
import { Empty, Flex, List } from "antd"
import type { ListGridType } from "antd/es/list"
import { IconLoader } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import InfiniteScroll from "react-infinite-scroll-component"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useStyles } from "./styles"

interface InfiniteListProps<T> {
	list: T[]
	hasMore: boolean
	isLoading: boolean
	loadMore: () => void
	renderItem: (item: T, index: number) => ReactNode
	emptyComponent?: ReactNode
	loadingComponent?: ReactNode
	endMessageComponent?: ReactNode
	grid?: ListGridType
	wrapperClassName?: string
	itemClassName?: string
	itemHeight?: number
}

export interface InfiniteListRef {
	getPageSize: () => number
}

const InfiniteList = forwardRef(function InfiniteList<T>(
	props: InfiniteListProps<T>,
	ref: React.ForwardedRef<InfiniteListRef>,
) {
	const {
		list,
		hasMore,
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

	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")
	const scrollRef = useRef<HTMLDivElement>(null)
	const scrollSize = useSize(scrollRef)

	const defaultLoader = useMemo(
		() => (
			<Flex justify="center" align="center" gap={4} className={styles.desc}>
				<IconLoader size={20} />
				<div>{t("common.loading")}</div>
			</Flex>
		),
		[styles.desc, t],
	)

	const defaultEndMessage = useMemo(
		() => (
			<Flex align="center" justify="center" className={styles.desc} gap={20}>
				<span>——————</span>
				<span>{t("common.noMore")}</span>
				<span>——————</span>
			</Flex>
		),
		[styles.desc, t],
	)

	const getColumnCount = useMemoizedFn(() => {
		if (!grid) return 1
		if (grid.column) return grid.column

		if (scrollSize?.width) {
			const { xs, sm, md, lg, xl, xxl } = grid

			if (scrollSize.width >= 1600 && xxl) return xxl
			if (scrollSize.width >= 1200 && xl) return xl
			if (scrollSize.width >= 992 && lg) return lg
			if (scrollSize.width >= 768 && md) return md
			if (scrollSize.width >= 576 && sm) return sm
			if (xs) return xs
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
			<div className={styles.empty}>
				<MagicSpin section spinning />
			</div>
		)
	}

	return (
		<div
			className={cx(styles.list, wrapperClassName, {
				[styles.empty]: list.length === 0,
			})}
			id="scrollableDiv"
			ref={scrollRef}
		>
			{!isLoading && list.length === 0
				? emptyComponent || <Empty description={t("noData")} />
				: null}
			{list.length > 0 ? (
				<InfiniteScroll
					next={loadMore}
					hasMore={hasMore}
					loader={loadingComponent || defaultLoader}
					endMessage={endMessageComponent || defaultEndMessage}
					dataLength={list.length}
					scrollableTarget="scrollableDiv"
					className={styles.scrollWrapper}
				>
					<List
						grid={grid}
						dataSource={list}
						renderItem={(item, index) => (
							<List.Item
								key={item || index}
								className={itemClassName || styles.listItem}
							>
								{renderItem(item, index)}
							</List.Item>
						)}
					/>
				</InfiniteScroll>
			) : null}
		</div>
	)
})

export default observer(InfiniteList) as typeof InfiniteList
