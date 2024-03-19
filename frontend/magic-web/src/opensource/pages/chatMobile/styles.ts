import { createStyles } from "antd-style"
import { CHAT_MOBILE_Z_INDEX } from "./constants"

export const useStyles = createStyles(({ token, css, prefixCls }) => ({
	container: {
		height: "100%",
		backgroundColor: token.magicColorUsages?.bg?.[0],
		display: "flex",
		flexDirection: "column",
		// paddingTop: token.safeAreaInsetTop,
		paddingBottom: `calc(${token.safeAreaInsetBottom} + 30px)`,
	},
	chatContentContainer: css`
		height: 100%;
		overflow-y: auto;
		position: relative;
		background-color: ${token.magicColorScales?.grey?.[0]};
		display: flex;
		flex-direction: column;
	`,
	statusBar: {
		height: 44,
		backgroundColor: token.magicColorUsages?.bg?.[0],
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		padding: "0 24px",
		fontSize: 15,
		fontWeight: 600,
		color: token.magicColorUsages?.text?.[0],
	},
	statusBarLeft: {
		fontSize: 15,
		fontWeight: 600,
	},
	statusBarRight: {
		display: "flex",
		alignItems: "center",
		gap: 6,
	},
	statusBarIcon: {
		width: 16,
		height: 11,
	},
	messageTypes: {
		backgroundColor: token.magicColorUsages?.bg?.[0] || "#ffffff",
		padding: "6px 10px 0 14px",
	},
	messageTypeContainer: {
		display: "flex",
		alignItems: "center",
		gap: 6,
	},
	messageTypeLeft: {
		width: 30,
		height: 30,
		borderRadius: "50%",
		backgroundColor: token.magicColorUsages?.fill?.[1] || "rgba(46, 47, 56, 0.05)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	messageTypeTabs: {
		display: "flex",
		flexDirection: "column",
		gap: 10,
		flex: 1,
	},
	messageTabRow: {
		backgroundColor: token.magicColorUsages?.fill?.[1] || "rgba(46, 47, 56, 0.05)",
		borderRadius: 100,
		padding: 3,
		display: "flex",
		gap: 10,
	},
	messageTab: {
		backgroundColor: token.magicColorUsages?.bg[0] || "#ffffff",
		borderRadius: 100,
		padding: "2px 20px",
		boxShadow: "0px 0px 1px 0px rgba(0, 0, 0, 0.3), 0px 4px 14px 0px rgba(0, 0, 0, 0.1)",
		fontSize: 14,
		fontWeight: 600,
		color: token.magicColorUsages?.primary.default,
		border: "none",
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		"&:active": {
			backgroundColor: token.magicColorUsages?.fill[1] || "#f0f0f0",
		},
	},
	messageTabInactive: {
		backgroundColor: "transparent",
		borderRadius: 100,
		padding: "2px 20px",
		boxShadow: "none",
		fontSize: 14,
		fontWeight: 400,
		color: token.magicColorUsages?.text[1],
		border: "none",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		gap: 10,
		transition: "background-color 0.2s ease",
		"&:active": {
			backgroundColor: token.magicColorUsages?.fill[1],
		},
	},
	messageTypeRight: {
		width: 30,
		height: 30,
		borderRadius: "50%",
		backgroundColor: token.magicColorUsages?.bg[1],
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		cursor: "pointer",
		transition: "background-color 0.2s ease",
		"&:active": {
			backgroundColor: token.magicColorUsages?.bg[1],
		},
	},
	segmentedContainer: css`
		z-index: ${CHAT_MOBILE_Z_INDEX.SEGMENTED_CONTAINER};
		position: relative;
	`,
	segmented: css`
		.${prefixCls}-segmented-item-label {
			padding: 2px 20px;
			overflow: visible;
			font-size: ${token.magicFontUsages.response.text14px};
			font-weight: 400;
			line-height: 20px;
			color: ${token.magicColorUsages?.text[1]};
			--${prefixCls}-control-height: 20px;
		}

		.${prefixCls}-segmented-item-selected .magic-segmented-item-label {
			color: ${token.magicColorUsages?.primary.default};
			font-weight: 600;
		}

		.${prefixCls}-segmented-item-selected .${prefixCls}-badge > span {
			color: ${token.magicColorUsages?.primary.default};
		}
	`,
	pinnedMessage: css`
		background: ${token.magicColorUsages?.bg[0]};
		border-bottom: 1px solid ${token.magicColorUsages?.border};
		padding: 6px 12px 12px 12px;
		display: flex;
		align-items: center;
		gap: 4px;
		position: sticky;
		top: 0;
		width: 100%;
		z-index: ${CHAT_MOBILE_Z_INDEX.PINNED_MESSAGE_HEADER};
		color: ${token.magicColorUsages?.text[1]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		cursor: pointer;
		transform: translateY(-1px);
	`,
	pinnedMessageList: css`
		transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		background-color: ${token.magicColorUsages?.bg[0]};
		position: relative;
		z-index: ${CHAT_MOBILE_Z_INDEX.PINNED_MESSAGE_LIST};
		flex-shrink: 0;
		overflow: hidden;
	`,
	pinnedMessageListContent: css`
		overflow: hidden;
		height: 100%;
	`,
	pinnedIcon: {
		width: 18,
		height: 18,
		color: token.magicColorUsages?.text[1] || "rgba(28, 29, 35, 0.8)",
		cursor: "pointer",
		transition: "color 0.2s ease",
		"&:active": {
			color: token.magicColorUsages?.text[0] || "rgba(28, 29, 35, 1)",
		},
	},
	pinnedText: {
		fontSize: 12,
		color: token.magicColorUsages?.text[1] || "rgba(28, 29, 35, 0.8)",
		flex: 1,
	},
	homeIndicator: {
		width: 375,
		height: 34,
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	homeIndicatorBar: {
		width: 134,
		height: 5,
		backgroundColor: token.magicColorUsages?.text[0],
		borderRadius: 100,
	},
	loadingOverlay: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background-color: ${token.magicColorUsages?.bg?.[0]};
		z-index: 10;
	`,
	loadingText: css`
		color: ${token.magicColorUsages?.text?.[2]};
		font-size: ${token.magicFontUsages.response.text14px};
		font-weight: 400;
		line-height: 20px;
	`,
}))
