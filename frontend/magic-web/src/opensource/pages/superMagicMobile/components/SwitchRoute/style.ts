import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	container: {
		marginTop: 10,
		// paddingBottom: 20,
		// borderBottom: `1px solid ${token.colorBorder}`,
		paddingBottom: 20,
	},
	title: {
		fontSize: "12px",
		color: token.colorTextSecondary,
		fontWeight: 400,
		marginBottom: 10,
	},
	routeContainer: {
		display: "flex",
		flexDirection: "column",
		gap: 10,
	},
	item: {
		fontSize: "14px",
		fontWeight: 400,
		height: 40,
		display: "flex",
		alignItems: "center",
		gap: 4,
		borderRadius: 8,
		padding: 10,
	},
	itemActive: {
		backgroundColor: token.colorPrimaryBg,
		color: token.colorPrimary,
	},
	icon: {
		width: "20px",
		height: "20px",
	},
}))
