import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => {
	return {
		mediaViewer: {
			width: "100%",
			height: "100%",
			backgroundColor: token.colorBgBase,
			overflow: "auto",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
		},
		mediaContainer: {
			width: "100%",
			height: "calc(100% - 44px)",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			background: `${token.colorBgBlur}`,
			position: "relative",
		},
		videoContainer: {
			flex: 1,
			minHeight: "400px", // Ensure minimum height
			width: "100%",
		},
		videoWrapper: {
			width: "calc(100% - 40px)",
			height: "calc(100% - 152px)", // Reduced height since no custom controls
			maxWidth: "100%",
			borderRadius: 12,
			overflow: "hidden",
			position: "relative",
			display: "flex",
			flexDirection: "column",
			"@media (max-width: 768px)": {
				width: "calc(100% - 20px)",
				height: "calc(100% - 80px)",
				borderRadius: 8,
			},
		},
		video: {
			display: "block",
			width: "100%",
			height: "100%", // Fill the container
			minHeight: "300px", // Ensure minimum height for player
			maxWidth: "100%",
			maxHeight: "100%",
			margin: "0 auto",
			objectFit: "contain",
			position: "relative",
			// Fullscreen styles
			"&:fullscreen": {
				width: "100vw",
				height: "100vh",
				backgroundColor: "#000",
			},
			// WebKit fullscreen
			"&:-webkit-full-screen": {
				width: "100vw",
				height: "100vh",
				backgroundColor: "#000",
			},
			// Global fullscreen styles for xgplayer
			[`${css`
				.xgplayer:fullscreen,
				.xgplayer:-webkit-full-screen,
				.xgplayer:-moz-full-screen,
				.xgplayer:-ms-fullscreen {
					width: 100vw !important;
					height: 100vh !important;
					background-color: #000 !important;
				}
			`}`]: {},
		},
		videoPlaceholder: {
			width: "100%",
			height: "100%",
			minHeight: "200px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			background: "#000",
		},
		loadingOverlay: {
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			width: 80,
			height: 80,
			borderRadius: 100,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 10,
			"@media (max-width: 768px)": {
				width: 60,
				height: 60,
			},
		},
	}
})
