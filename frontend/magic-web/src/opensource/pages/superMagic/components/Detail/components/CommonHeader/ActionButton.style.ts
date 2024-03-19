import { createStyles } from "antd-style"
import { createPhoneModeContainerStyle } from "../../styles/commonStyles"

// Define the styles using createStyles
export const useStyles = createStyles(({ token, css, prefixCls }) => {
	return {
		actionButtons: {
			width: "100%",
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 4,
			flex: "0 0 auto", // 不伸缩，保持内容宽度
			whiteSpace: "nowrap",
		},
		mobileActionButtons: {
			justifyContent: "space-between",
		},
		iconWrapper: {
			padding: "5px",
			userSelect: "none",
			"&:hover": {
				backgroundColor: token.magicColorUsages.fill[0],
			},

			"&:active": {
				backgroundColor: token.magicColorUsages.fill[1],
			},
		},
		iconCommon: {
			cursor: "pointer",
			stroke: token.colorTextSecondary,
			borderRadius: "10px",
		},
		disabled: {
			opacity: 0.5,
			cursor: "not-allowed",
		},
		favorited: {
			stroke: "#FFD700", // 金色，表示已收藏状态
			"&:hover": {
				backgroundColor: "#FFF7E6",
			},
		},
		iconText: {
			fontSize: "12px",
			lineHeight: "12px",
			display: "inline-block",
			overflow: "hidden",
			transition: "max-width 0.18s ease, opacity 0.18s ease, transform 0.18s ease",
			willChange: "max-width, opacity, transform",
		},
		iconTextVisible: {
			maxWidth: 140,
			opacity: 1,
			transform: "translateX(0)",
		},
		iconTextHidden: {
			maxWidth: 0,
			opacity: 0,
			transform: "translateX(-2px)",
		},
		contextTag: {
			fontSize: 12,
			color: token.colorTextTertiary,
			backgroundColor: token.colorFillQuaternary,
			padding: "2px 6px",
			borderRadius: token.borderRadiusSM,
			marginLeft: 8,
		},
		switchButton: {
			width: "24px",
			height: "24px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			border: "none",
			borderRadius: "4px",
			cursor: "pointer",
			backgroundColor: token.magicColorUsages.white,
			color: token.magicColorUsages.black,
			userSelect: "none",
			transition: "all 0.2s ease",
			"&:hover": {
				backgroundColor: "rgba(255, 255, 255, 0.8)",
			},
		},
		active: {
			backgroundColor: "transparent",
			color: token.magicColorUsages.text[2],
		},
		phoneModeContainer: createPhoneModeContainerStyle(token),
		openUrlButton: {
			borderRadius: 0,
		},
		moreOperationsDropdown: css`
			&.${prefixCls}-dropdown-menu {
				padding: 10px;
				display: flex;
				flex-direction: column;
				gap: 4px;

				&.${prefixCls}-dropdown-menu-submenu-hidden {
					display: none !important;
				}
			}
			.${prefixCls}-dropdown-menu-item {
				padding: 6px 10px;
			}
			.${prefixCls}-dropdown-menu-sub {
				padding: 10px;
				display: flex;
				flex-direction: column;
				gap: 4px;
				.${prefixCls}-dropdown-menu-item-only-child {
					padding: 0 !important;
				}
			}
		`,
		fileVersionsDropdownItem: {
			display: "flex",
			alignItems: "center",
			gap: 4,
			color: token.magicColorUsages.text[1],
		},
		fileVersionsDropdownItemTitle: {
			minWidth: 140,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 400,
		},
		version: css`
			padding: 2px 10px;
			font-size: 10px;
			line-height: 13px;
			border-radius: 4px;
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		versionItem: css`
			padding: 6px 2px 6px 10px;
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 20px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[1]};
			border-radius: 4px;
			background-color: ${token.magicColorUsages.bg[3]};
			cursor: pointer;
			transition: background-color 0.3s ease;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}
		`,
		checkedVersionItem: css`
			background-color: ${token.magicColorUsages.primaryLight.default};
			cursor: default;

			&:hover {
				background-color: ${token.magicColorUsages.primaryLight.default};
			}
		`,
		createdAt: css`
			font-size: 10px;
			line-height: 13px;
			color: ${token.magicColorUsages.text[3]};
		`,
		checkedIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			color: ${token.magicColorUsages.primary.default};
		`,
		loadMoreHint: css`
			padding: 6px 8px;
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[2]};
			background-color: ${token.magicColorUsages.fill[0]};
			border-radius: 4px;
		`,
		noHistoryVersionHint: css`
			min-width: 120px;
			text-align: center;
		`,
	}
})
