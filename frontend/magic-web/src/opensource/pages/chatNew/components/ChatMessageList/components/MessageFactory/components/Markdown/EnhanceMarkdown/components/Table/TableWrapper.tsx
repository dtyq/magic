import React, {
	useState,
	useMemo,
	cloneElement,
	isValidElement,
	useRef,
	useEffect,
	useCallback,
} from "react"
import { Switch } from "antd"
import RowDetailDrawer from "./RowDetailDrawer"
import { useTableStyles } from "./styles"
import { useTableI18n } from "./useTableI18n"

// Table column limit configuration
const DEFAULT_MAX_COLUMNS = 5 // Default maximum columns

// Utility function to extract table data
const extractTableData = (children: React.ReactNode, i18n: ReturnType<typeof useTableI18n>) => {
	const rows: React.ReactNode[][] = []
	let headers: string[] = []

	const processChildren = (child: React.ReactNode) => {
		if (!isValidElement(child)) return

		// Handle React Fragment
		if (child.type === React.Fragment || typeof child.type === "symbol") {
			React.Children.forEach(child.props.children, processChildren)
			return
		}

		if (child.type === "thead") {
			// Handle table header
			const headRows = React.Children.toArray(child.props.children)
			headRows.forEach((headRow) => {
				if (isValidElement(headRow) && headRow.type === "tr") {
					const cells = React.Children.toArray(headRow.props.children)
					headers = cells.map((cell, index) => {
						if (isValidElement(cell)) {
							const cellContent = cell.props.children

							if (
								Array.isArray(cellContent) &&
								cellContent.length === 1 &&
								typeof cellContent[0] === "string"
							) {
								return cellContent[0]
							}

							return typeof cellContent === "string"
								? cellContent
								: `${i18n.defaultColumn} ${index + 1}`
						}
						return `${i18n.defaultColumn} ${index + 1}`
					})
				}
			})
		} else if (child.type === "tbody") {
			// Handle table body
			const bodyRows = React.Children.toArray(child.props.children)
			bodyRows.forEach((bodyRow) => {
				if (isValidElement(bodyRow) && bodyRow.type === "tr") {
					const cells = React.Children.toArray(bodyRow.props.children)
					const rowData = cells.map((cell) => {
						if (isValidElement(cell)) {
							return cell.props.children
						}
						return ""
					})
					rows.push(rowData)
				}
			})
		}
	}

	React.Children.forEach(children, processChildren)

	return { headers, rows }
}

// Custom Hook: Dynamic calculation of visible columns
const useDynamicColumnCount = (
	headers: string[],
	containerRef: React.RefObject<HTMLDivElement>,
) => {
	const [maxVisibleColumns, setMaxVisibleColumns] = useState(DEFAULT_MAX_COLUMNS)

	const calculateMaxColumns = useCallback(() => {
		if (!containerRef.current || headers.length === 0) {
			return DEFAULT_MAX_COLUMNS
		}

		const containerWidth = containerRef.current.offsetWidth
		if (containerWidth === 0) {
			return DEFAULT_MAX_COLUMNS
		}

		// If there are fewer columns, display all columns directly
		if (headers.length <= DEFAULT_MAX_COLUMNS) {
			return headers.length
		}

		// Ensure no less than minimum columns, but reserve space for at least 1 "more" column
		const finalMaxColumns = DEFAULT_MAX_COLUMNS

		return finalMaxColumns
	}, [headers.length, containerRef])

	useEffect(() => {
		const updateColumnCount = () => {
			const newMaxColumns = calculateMaxColumns()
			setMaxVisibleColumns(newMaxColumns)
		}

		// Initial calculation
		updateColumnCount()

		// Listen for container size changes
		const resizeObserver = new ResizeObserver(() => {
			updateColumnCount()
		})

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current)
		}

		// Listen for window size changes (as backup)
		const handleResize = () => {
			setTimeout(updateColumnCount, 100) // Delayed execution to ensure DOM update completion
		}

		window.addEventListener("resize", handleResize)

		return () => {
			resizeObserver.disconnect()
			window.removeEventListener("resize", handleResize)
		}
	}, [calculateMaxColumns])

	return maxVisibleColumns
}

// Modify table to add "Show More" column
const enhanceTableWithMoreColumn = (
	children: React.ReactNode,
	onShowMore: (rowIndex: number) => void,
	showMoreButtonClass: string,
	showMoreText: string,
	maxVisibleColumns: number,
	showAllColumns: boolean,
	onToggleShowAll: (checked: boolean) => void,
	showAllColumnsText: string,
	hideAllColumnsText: string,
	moreColumnHeaderClass: string,
): React.ReactNode => {
	return React.Children.map(children, (child) => {
		if (!isValidElement(child)) return child

		// Handle React Fragment
		if (child.type === React.Fragment || typeof child.type === "symbol") {
			return cloneElement(
				child,
				{},
				enhanceTableWithMoreColumn(
					child.props.children,
					onShowMore,
					showMoreButtonClass,
					showMoreText,
					maxVisibleColumns,
					showAllColumns,
					onToggleShowAll,
					showAllColumnsText,
					hideAllColumnsText,
					moreColumnHeaderClass,
				),
			)
		}

		if (child.type === "thead") {
			// Modify table header to add "Show More" column
			const headRows = React.Children.map(child.props.children, (headRow) => {
				if (!isValidElement(headRow) || headRow.type !== "tr") return headRow

				const cells = React.Children.toArray((headRow as any).props.children)

				// When showing all columns, display all original columns
				const visibleCells = showAllColumns ? cells : cells.slice(0, maxVisibleColumns)

				if (cells.length > maxVisibleColumns) {
					const moreHeaderCell = (
						<th key="more-header" style={{ textAlign: "center" }}>
							<div className={moreColumnHeaderClass}>
								<div className="switch-container">
									<Switch
										checkedChildren={hideAllColumnsText}
										unCheckedChildren={showAllColumnsText}
										checked={showAllColumns}
										onChange={onToggleShowAll}
									/>
								</div>
							</div>
						</th>
					)
					return cloneElement(headRow, {}, [...visibleCells, moreHeaderCell])
				}

				return headRow
			})

			return cloneElement(child, {}, headRows)
		}

		if (child.type === "tbody") {
			// Modify table body to add "Show More" button
			const bodyRows = React.Children.map(child.props.children, (bodyRow, rowIndex) => {
				if (!isValidElement(bodyRow) || bodyRow.type !== "tr") return bodyRow

				const cells = React.Children.toArray((bodyRow as any).props.children)

				// When showing all columns, display all original columns
				const visibleCells = showAllColumns ? cells : cells.slice(0, maxVisibleColumns)

				if (cells.length > maxVisibleColumns) {
					const moreButtonCell = (
						<td key="more-button" style={{ textAlign: "center" }}>
							<button
								className={showMoreButtonClass}
								onClick={() => onShowMore(rowIndex)}
								type="button"
							>
								{showMoreText}
							</button>
						</td>
					)
					return cloneElement(bodyRow, {}, [...visibleCells, moreButtonCell])
				}

				return bodyRow
			})

			return cloneElement(child, {}, bodyRows)
		}

		return child
	})
}

// Custom table component with horizontal scroll container and dynamic column limit functionality
const TableWrapper = ({ node, ...props }: any) => {
	const i18n = useTableI18n()
	const { styles, cx } = useTableStyles()
	const [drawerVisible, setDrawerVisible] = useState(false)
	const [currentRowData, setCurrentRowData] = useState<Record<string, React.ReactNode>>({})
	const [showAllColumns, setShowAllColumns] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const { headers, rows } = useMemo(
		() => extractTableData(props.children, i18n),
		[props.children, i18n],
	)

	// Use dynamic column count calculation Hook
	const maxVisibleColumns = useDynamicColumnCount(headers, containerRef)

	// Check if "More" column is needed (when total columns exceed maximum visible columns)
	const needsMoreColumn = headers.length > maxVisibleColumns

	const handleShowMore = (rowIndex: number) => {
		if (rows[rowIndex]) {
			const rowData: Record<string, React.ReactNode> = {}
			headers.forEach((header, index) => {
				rowData[header] = rows[rowIndex][index] || ""
				rowData[index] = rows[rowIndex][index] || ""
			})
			setCurrentRowData(rowData)
			setDrawerVisible(true)
		}
	}

	const handleCloseDrawer = () => {
		setDrawerVisible(false)
		setCurrentRowData({})
	}

	const enhancedChildren = needsMoreColumn
		? enhanceTableWithMoreColumn(
				props.children,
				handleShowMore,
				styles.showMoreButton,
				i18n.showMore,
				maxVisibleColumns,
				showAllColumns,
				setShowAllColumns,
				i18n.showAllColumns,
				i18n.hideAllColumns,
				styles.moreColumnHeader,
		  )
		: props.children

	return (
		<div ref={containerRef} className={cx(styles.tableContainer, styles.mobileTable)}>
			<table {...props}>{enhancedChildren}</table>

			<RowDetailDrawer
				visible={drawerVisible}
				onClose={handleCloseDrawer}
				rowData={currentRowData}
				headers={headers}
				title={i18n.rowDetails}
			/>
		</div>
	)
}

export default TableWrapper
