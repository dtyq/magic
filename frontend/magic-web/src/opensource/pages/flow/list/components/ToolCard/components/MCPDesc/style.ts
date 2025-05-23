import { createStyles } from "antd-style"

const useStyles = createStyles(() => ({
	version: {
		lineHeight: "16px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		display: "-webkit-box",
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: 1,
		wordBreak: "break-all",
	},
	latestVersion: {
		color: "#FF7D00",
		border: "1px solid #FF7D00",
		padding: "1px 5px",
		width: "fit-content",
		borderRadius: "4px",
		marginLeft: "-5px",
	},
}))

export default useStyles
