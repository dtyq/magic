import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	container: {
		paddingTop: 10,
		// paddingBottom: 20,
		borderTop: `1px solid ${token.colorBorder}`,
	},
	title: {
		fontSize: "12px",
		color: token.colorTextSecondary,
		fontWeight: 400,
		marginBottom: 10,
	},
	item: {
		fontSize: "14px",
		height: 40,
		display: "flex",
		alignItems: "center",
		gap: 4,
		borderRadius: 8,
		padding: 10,
		color: token.magicColorUsages.text[1],
	},
	itemActive: {
		backgroundColor: token.colorPrimaryBg,
		color: token.colorPrimary,
	},
	icon: {
		width: "20px",
		height: "20px",
	},
	attachmentList: {
		height: "100%",
		padding: "10px",
		display: "flex",
		gap: "10px",
		flexDirection: "column",
		overflow: "hidden",
	},
}))
