import { memo, useMemo } from "react"
import { createStyles } from "antd-style"

// Types
import type { AssistantGridData, AssistantFlatData, AssistantData } from "../../types"

// Components
import AssistantCard from "../AssistantCard"
import { CSS_VARIABLES } from "../../constants"

const useStyles = createStyles(({ css }) => ({
	assistantGrid: css`
		display: flex;
		gap: 20px;
		overflow-x: auto;
		padding-bottom: 10px;
		padding-inline: var(${CSS_VARIABLES.explorePagePaddingInline});

		overflow-y: auto;
		height: 100%;

		/* Hide scrollbar but keep functionality */
		scrollbar-width: none;
		-ms-overflow-style: none;
		&::-webkit-scrollbar {
			display: none;
		}

		/* Smooth scrolling */
		scroll-behavior: smooth;

		/* Performance optimization */
		will-change: scroll-position;
	`,

	assistantColumn: css`
		display: flex;
		flex-direction: column;
		gap: 14px;
		flex-shrink: 0;

		/* Dynamic column width based on column count */
		min-width: 280px;
	`,
}))

/**
 * Utility function to split flat array into columns
 * @param data - Flat array of assistant data
 * @param columns - Number of columns to create
 * @returns Array of columns (2D array)
 */
function splitIntoColumns(data: AssistantData[], columns: number): AssistantData[][] {
	if (columns <= 0) return []
	if (data.length === 0) return Array(columns).fill([])

	const result: AssistantData[][] = Array(columns)
		.fill(null)
		.map(() => [])

	// Distribute items evenly across columns
	data.forEach((item, index) => {
		const columnIndex = index % columns
		result[columnIndex].push(item)
	})

	return result
}

export interface AssistantGridProps {
	// Support both data formats for backward compatibility
	data?: AssistantGridData
	flatData?: AssistantFlatData
	columns?: number // Number of columns when using flatData
	onAssistantClick: (assistantId: string) => void
}

const AssistantGrid = memo(
	({ data, flatData, columns = 2, onAssistantClick }: AssistantGridProps) => {
		const { styles } = useStyles()

		// Process data based on input format
		const processedData = useMemo(() => {
			// If flatData is provided, use it with custom columns
			if (flatData) {
				return splitIntoColumns(flatData, columns)
			}

			// Otherwise, use the original data format
			return data || []
		}, [data, flatData, columns])

		// Calculate dynamic column width based on column count
		const columnStyle = useMemo(() => {
			if (flatData && columns > 0) {
				const baseWidth = Math.max(280, Math.floor(100 / columns) - 2) // Minimum 280px
				return {
					width: `${baseWidth}px`,
					maxWidth: `${Math.floor(100 / columns)}%`,
				}
			}

			// Default width for backward compatibility
			return {
				// width: "88%",
				width: "100%",
			}
		}, [flatData, columns])

		return (
			<div className={styles.assistantGrid}>
				{processedData.map((column, columnIndex) => (
					<div key={columnIndex} className={styles.assistantColumn} style={columnStyle}>
						{column.map((assistant) => (
							<AssistantCard
								key={assistant.id}
								assistant={assistant}
								onClick={() => onAssistantClick(assistant.id)}
							/>
						))}
					</div>
				))}
			</div>
		)
	},
)

AssistantGrid.displayName = "AssistantGrid"

export default AssistantGrid
