import { createStyles } from "antd-style"
import {
	createPreviewContainerBaseStyle,
	createPreviewInnerBaseStyle,
	createPhoneModeContainerStyle,
	createPhoneModeInnerStyle,
} from "../../styles/commonStyles"

export const useStyles = createStyles(({ token, responsive, css }) => {
	return {
		htmlContainer: {
			display: "flex",
			flexDirection: "column",
			height: "100%",
		},
		immersiveHtmlContainer: {
			minHeight: 0,
			width: "100%",
			backgroundColor: "transparent",
		},
		htmlBody: {
			overflow: "hidden auto",
			flex: 1,
			backgroundColor: "white",
			height: "100%",
			minHeight: 0,
			"& pre": {
				background: `${token.colorBgBase}!important`,
			},
		},
		previewContainerBase: createPreviewContainerBaseStyle(),
		previewInnerBase: createPreviewInnerBaseStyle(),
		immersivePreviewContainer: {
			flex: 1,
			minHeight: 0,
			height: "100%",
			padding: 0,
			background: "transparent",
		},
		immersivePreviewInner: {
			flex: 1,
			minHeight: 0,
			height: "100%",
			width: "100%",
			maxWidth: "100%",
			borderRadius: 0,
			border: "none",
			boxShadow: "none",
		},
		phoneModeContainer: createPhoneModeContainerStyle(token),
		phoneModeInner: createPhoneModeInnerStyle(token),
		header: {
			background: "white",
			paddingRight: "20px",
			borderBottom: `1px solid ${token.colorBorderSecondary}`,
		},
		navigate: {
			background: "none",
			flex: 1,
			[responsive.mobile]: {
				flex: 1,
				flexShrink: 1,
				minWidth: 0,
			},
		},
		shareIcon: {
			cursor: "pointer",
		},
		editText: css`
			font-size: 12px;
		`,
		editButton: css`
			height: 22px;
		`,
		downloadText: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,
	}
})
