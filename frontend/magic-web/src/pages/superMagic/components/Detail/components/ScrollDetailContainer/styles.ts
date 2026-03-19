import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => ({
	container: {
		display: "flex",
		flexDirection: "column",
		height: "100%",
		overflow: "hidden",
		backgroundColor: "transparent",
		position: "relative",
	},
	fullscreen: {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		height: "100vh",
		width: "100vw",
		zIndex: 1000,
		borderRadius: 0,
	},
	scrollContainer: {
		height: "100%",
		width: "100%",
	},
	virtuosoScroller: {
		height: "100%",
		overflowY: "auto",
		overflowX: "hidden",
		"&::-webkit-scrollbar": {
			width: "4px",
		},
		"&::-webkit-scrollbar-track": {
			background: "transparent",
		},
		"&::-webkit-scrollbar-thumb": {
			backgroundColor: token.magicColorUsages.fill[2],
			borderRadius: "100px",
		},
		// Firefox
		scrollbarWidth: "thin",
		scrollbarColor: `${token.magicColorUsages.fill[2]} transparent`,
	},
	center: {
		"&>div": {
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
		},
	},
	itemContainer: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	itemContent: {
		width: "900px",
		height: "740px",
		borderRadius: "8px",
		overflow: "hidden",
		boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 0px 30px 0px rgba(0, 0, 0, 0.06)",
		backgroundColor: "#FFFFFF",
	},
	fullscreenContent: {
		position: "fixed",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: "100vw",
		height: "100vh",
		zIndex: 1000,
		backgroundColor: "#FFFFFF",
		overflow: "hidden",
	},
}))
