import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	batchOperationButton: {
		padding: "0px 12px",
		gap: 4,
	},
	starIcon: {
		color: token.magicColorScales.yellow[5],
	},
	starIconButton: {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	topicButton: {
		padding: 0,
	},
	pagination: {
		margin: "16px 0 0 0 !important",
	},
	operationButton: {
		padding: 0,
	},
	table: {
		"& .magic-table-thead > tr > th": {
			backgroundColor: token.magicColorScales.grey[0],
			height: 48,
		},
		"& .magic-table": {
			borderRadius: 0,
		},
		"& .magic-table-header": {
			borderRadius: "0px !important",
		},
		"& table": {
			borderRadius: 0,
		},
		":where(.css-dev-only-do-not-override-tifxjm).magic-table-wrapper .magic-table-container table>thead>tr:first-child >*:first-child":
			{
				borderTopLeftRadius: 0,
			},
		":where(.css-dev-only-do-not-override-tifxjm).magic-table-wrapper .magic-table-container table>thead>tr:first-child >*:last-child":
			{
				borderTopRightRadius: 0,
			},
	},
}))
