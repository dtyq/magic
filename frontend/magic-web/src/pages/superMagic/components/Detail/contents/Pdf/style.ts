import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		pdfViewer: {
			width: "100%",
			height: "100%",
			backgroundColor: token.colorBgBase,
			overflow: "hidden",
			position: "relative",
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
		},
		pdfContainer: {
			flex: 1,
			width: "100%",
			// height: "100%",
			overflow: "auto",
			position: "relative",
			"& .react-pdf__Document": {
				display: "flex",
				flexDirection: "column",
			},
			"& .react-pdf__Page": {
				margin: "0",
				boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
			},
		},
		// 当缩放小于100%时使用居中布局
		pdfContainerCentered: {
			width: "100%",
			height: "100%",
			overflow: "auto",
			position: "relative",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			"& .react-pdf__Document": {
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			},
			"& .react-pdf__Page": {
				margin: "10px 0",
				boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
			},
		},
		zoomIcon: {
			width: "18px",
			height: "18px",
		},
		zoomButton: {
			background: "none",
			border: "none",
			outline: "none",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "32px",
			height: "32px",
			borderRadius: "50%",
			transition: "background 0.2s",
			color: "#fff",
			fontSize: "20px",
			"&:hover": {
				background: "rgba(255,255,255,0.12)",
			},
		},
		zoomSlider: {
			width: "160px", // PC端拉长
			margin: "0 12px",
		},
		zoomSliderMobile: {
			width: "100px", // 移动端缩小
			margin: "0 8px",
		},
		zoomPercent: {
			color: "#fff",
			fontSize: "16px",
			width: "48px",
			textAlign: "center",
		},
		zoomPercentMobile: {
			color: "#fff",
			fontSize: "14px",
			width: "40px",
			textAlign: "center",
		},
		zoomButtonMobile: {
			background: "none",
			border: "none",
			outline: "none",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "28px",
			height: "28px",
			borderRadius: "50%",
			transition: "background 0.2s",
			color: "#fff",
			fontSize: "18px",
			"&:hover": {
				background: "rgba(255,255,255,0.12)",
			},
		},
		rotateButton: {
			background: "none",
			border: "none",
			outline: "none",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "32px",
			height: "32px",
			borderRadius: "50%",
			transition: "background 0.2s",
			color: "#fff",
			fontSize: "20px",
			marginLeft: "8px",
			"&:hover": {
				background: "rgba(255,255,255,0.12)",
			},
		},
		loading: {
			width: "100%",
			height: "100px",
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			color: token.colorTextSecondary,
		},
		pageButton: {
			padding: "4px 12px",
			borderRadius: "4px",
			cursor: "pointer",
			backgroundColor: token.colorPrimary,
			color: token.colorWhite,
			border: "none",
			outline: "none",
			"&:disabled": {
				opacity: 0.5,
				cursor: "not-allowed",
			},
		},
		pageInfo: {
			fontSize: "14px",
			color: token.colorTextSecondary,
		},
	}
})
