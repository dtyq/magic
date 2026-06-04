import { memo, useMemo, useRef } from "react"
import { Flex, type TableProps, type RowProps } from "antd"
import type { AnyObject } from "antd/es/_util/type"
import { useSize } from "ahooks"
import MagicTable from "../MagicTable"
import { SearchForm } from "./SearchForm"
import type { SearchItem, TableButton } from "./types"
import { useStyles } from "./style"

/**
 * 表格组件
 * @param props 组件属性
 * @returns 表格组件
 */
export interface TableWithFiltersProps<T extends AnyObject> extends TableProps<T> {
	/** 类名 */
	className?: string
	/** 样式 */
	style?: React.CSSProperties
	/** 顶部额外内容 */
	extra?: React.ReactNode
	/** 按钮 */
	buttons?: TableButton[]
	/** 分页高度 */
	paginationHeight?: number
	/** 表格头部高度 */
	tableHeaderHeight?: number
	/** 额外的高度 */
	extraHeight?: number
	/** 搜索配置 */
	search?: SearchItem[]
	/** 搜索布局, 默认为排列平铺, 如果需要两端对齐, 请使用 "space-between" */
	justify?: RowProps["justify"]
}

const TableWithFilters = <T extends AnyObject>({
	extra,
	buttons,
	className,
	style,
	dataSource,
	paginationHeight = 74,
	extraHeight = 0,
	tableHeaderHeight = 57,
	search,
	justify,
	...props
}: TableWithFiltersProps<T>) => {
	const headerRef = useRef(null)
	const headerSize = useSize(headerRef)

	// 实际的分页高度
	const pageHeight = useMemo(() => {
		if (dataSource?.length) {
			return paginationHeight
		}
		return 0
	}, [dataSource, paginationHeight])

	// 表格高度
	const tableHeight = useMemo(() => {
		return (
			window.innerHeight -
			extraHeight -
			tableHeaderHeight -
			(headerSize?.height ?? 0) -
			pageHeight
		)
	}, [headerSize, pageHeight, tableHeaderHeight, extraHeight])

	const { styles, cx } = useStyles({ height: tableHeight })

	return (
		<Flex vertical gap={10} className={cx(styles.tabContent, className)} style={style}>
			<Flex gap={10} vertical ref={headerRef}>
				{extra}
				{(search || buttons) && (
					<SearchForm
						items={search}
						buttons={buttons}
						justify={justify}
						height={tableHeight}
					/>
				)}
			</Flex>
			<MagicTable<T>
				pagination={{
					pageSize: 20,
					position: ["bottomLeft"],
					rootClassName: styles.pagination,
				}}
				dataSource={dataSource}
				scroll={{ x: "max-content", y: tableHeight }}
				className={styles.table}
				{...props}
			/>
		</Flex>
	)
}

export default memo(TableWithFilters) as <T extends AnyObject>(
	props: TableWithFiltersProps<T>,
) => JSX.Element
