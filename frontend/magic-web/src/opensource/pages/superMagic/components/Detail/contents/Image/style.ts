import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token }) => {
	return {
		pdfViewer: {
			width: "100%",
			height: "100%",
			backgroundColor: token.colorBgBase,
			overflow: "auto",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
		},
		pdfContainer: {
			width: "100%",
			height: "100%",
			overflow: "auto",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			background: `${token.colorBgBlur}`,
		},
		loadingContainer: {
			width: "48px",
			height: "48px",
		},
		imagePreview: {
			height: "100%",
		},
		imagePreviewToolContainer: {
			height: "40px",
		},
		zoomIcon: {
			width: "18px",
			height: "18px",
		},
		pdfViewerContainer: {
			width: "100%",
			position: "fixed",
			bottom: "0px",
			display: "flex",
			gap: "18px",
			alignItems: "center",
			justifyContent: "center",
			padding: "18px",
			borderRadius: "4px",
			zIndex: 1000,
			cursor: "pointer",
		},
	}
})
