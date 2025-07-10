import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	checkBox: {
		position: "relative",
		width: 16,
		height: 16,
	},
	checkBoxLabel: {
		cursor: "pointer",
		position: "absolute",
		width: 16,
		height: 16,
		top: 0,
		left: 0,
		background: "white",
		border: `1px solid ${token.colorBorder}`,
		borderRadius: 4,
		"&::after": {
			content: "''",
			position: "absolute",
			width: 8,
			height: 2,
			border: "2px solid white",
			borderTop: "none",
			borderRight: "none",
			borderLeft: "none",
			top: "48%",
			left: 3,
			opacity: 0,
		},
	},
	checkBoxInput: {
		visibility: "hidden",
	},
	checkBoxInputChecked: {
		"& + label": {
			opacity: 1,
			background: token.colorPrimary,
			"&::after": {
				opacity: 1,
				backgroundColor: "unset",
			},
		},
	},
}))
