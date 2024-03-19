import type { ReactElement } from "react"
import { cloneElement, useMemo, useRef, useState } from "react"
import type { PaginationProps } from "antd"
import { Flex, List, Pagination } from "antd"
import type { DescriptionsItemType } from "antd/es/descriptions"
import type { SearchItem, TableButton } from "../TableWithFilters"
import { useStyles } from "./style"
import DetailDrawer from "../DetailDrawer"
import MobileFilter from "../MobileFilter"
import { useAdminComponents } from "../AdminComponentsProvider"

interface PageParams {
	page?: number
	page_size?: number
}

export interface MobileListProps<T extends PageParams, D extends Record<string, any>> {
	data: D[]
	loading: boolean
	total?: number
	currentFilters: T
	/** 搜索配置 */
	search?: SearchItem[]
	/** 按钮 */
	buttons?: TableButton[]
	showDetail?: boolean
	paginationConfig?: PaginationProps
	CardComponent: ReactElement<{
		data?: D
		onClick?: (item: D) => void
	}>
	getDetailItems?: (item: D | null) => DescriptionsItemType[]
	onPageChange?: (page: number, pageSize: number) => void
	handleReset?: () => void
}

function MobileList<T extends PageParams, D extends Record<string, any>>({
	data,
	loading,
	total,
	currentFilters,
	search,
	buttons,
	CardComponent,
	showDetail = true,
	paginationConfig,
	getDetailItems,
	handleReset,
}: MobileListProps<T, D>) {
	const { styles } = useStyles()

	const { getLocale } = useAdminComponents()
	const locale = getLocale("MobileList")

	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const [selectedItem, setSelectedItem] = useState<D | null>(null)
	const [drawerOpen, setDrawerOpen] = useState(false)

	// 计算筛选数量
	const filterCount = useMemo(() => {
		return Object.entries(currentFilters).filter(([key, value]) => {
			if (key === "page" || key === "page_size") {
				return false
			}
			if (Array.isArray(value) && value.length > 0) {
				return true
			}
			if (typeof value === "string" && value.trim() !== "") {
				return true
			}
			return false
		}).length
	}, [currentFilters])

	const handleCardClick = (item: D) => {
		if (!showDetail) return
		setSelectedItem(item)
		setDrawerOpen(true)
	}

	const handleDrawerClose = () => {
		setDrawerOpen(false)
		setTimeout(() => {
			setSelectedItem(null)
		}, 300)
	}

	const onInnerPageChange = (page: number, pageSize: number) => {
		paginationConfig?.onChange?.(page, pageSize)
		scrollContainerRef.current?.scrollTo({
			top: 0,
			behavior: "smooth",
		})
	}

	const detailItems = useMemo(() => {
		if (!selectedItem) return []
		return getDetailItems?.(selectedItem) || []
	}, [getDetailItems, selectedItem])

	return (
		<div className={styles.container}>
			{/* 顶部筛选栏 */}
			<Flex
				justify={total ? "space-between" : "end"}
				align="center"
				gap={12}
				className={styles.filterBar}
			>
				{total ? (
					<span className={styles.totalText}>
						{locale.total} {total} {locale.unit}
					</span>
				) : null}
				{search && (
					<MobileFilter
						search={search}
						buttons={buttons}
						filterCount={filterCount}
						handleReset={handleReset}
					/>
				)}
			</Flex>

			<Flex vertical className={styles.scrollContainer} ref={scrollContainerRef}>
				<List
					className={styles.list}
					loading={loading}
					dataSource={data}
					renderItem={(item) =>
						cloneElement(CardComponent, {
							data: item,
							onClick: handleCardClick,
						})
					}
				/>

				<Pagination
					className={styles.pagination}
					{...paginationConfig}
					onChange={onInnerPageChange}
					simple={!!total}
				/>
			</Flex>

			{detailItems.length > 0 && (
				<DetailDrawer open={drawerOpen} items={detailItems} onClose={handleDrawerClose} />
			)}
		</div>
	)
}

export default MobileList
