import { createStyles } from "antd-style"
import { Z_INDEX, ANIMATIONS } from "./constants"

export const useMobileStyles = createStyles(({ token, css, responsive }) => {
	// Mobile-specific design tokens
	const mobileTokens = {
		colors: {
			background: token.colorBgContainer,
			selectedBackground: token.magicColorUsages?.primaryLight?.default || token.colorPrimary,
			text: token.colorText,
			secondaryText: token.colorTextSecondary,
			hintText: token.magicColorUsages?.text?.[3] || token.colorTextTertiary,
			border: token.colorBorder,
			overlay: token.magicColorUsages?.overlay?.bg || "rgba(0, 0, 0, 0.5)",
		},
		spacing: {
			popupPadding: "16px",
			headerPadding: "12px 16px",
			contentPadding: "0 6px",
			itemPadding: "8px 12px",
			itemGap: "8px",
			bottomSafeArea: token.safeAreaInsetBottom || "0px",
		},
		sizes: {
			popupMaxHeight: "80vh",
			headerHeight: "56px",
			itemHeight: "48px",
			iconSize: "20px",
			borderRadius: "16px",
			itemBorderRadius: "8px",
		},
		fonts: {
			primary: '"PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif',
			header: {
				fontSize: "18px",
				fontWeight: "600",
				lineHeight: "24px",
			},
			itemTitle: {
				fontSize: "16px",
				fontWeight: "400",
				lineHeight: "22px",
			},
			itemDescription: {
				fontSize: "14px",
				fontWeight: "400",
				lineHeight: "20px",
			},
			hintText: {
				fontSize: "12px",
				fontWeight: "400",
				lineHeight: "16px",
			},
		},
		hover: {
			itemHoverBg: token.colorFillQuaternary,
		},
	}

	// Base popup styles
	const popupBase = css`
		--adm-color-background: ${mobileTokens.colors.background};
		border-radius: ${mobileTokens.sizes.borderRadius} ${mobileTokens.sizes.borderRadius} 0 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		font-family: ${mobileTokens.fonts.primary};
		max-height: ${mobileTokens.sizes.popupMaxHeight};
	`

	return {
		// Popup body
		popupBody: css`
			${popupBase}
		`,

		// Custom mask with blur effect
		mask: css`
			background: ${mobileTokens.colors.overlay};
			backdrop-filter: blur(4px);
			-webkit-backdrop-filter: blur(4px);
		`,

		// Popup container
		container: css`
			display: flex;
			flex-direction: column;
			height: 80vh;
			width: 100%;
			background: ${mobileTokens.colors.background};
			overflow: hidden;
		`,

		// Header section
		header: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: ${mobileTokens.spacing.headerPadding};
			height: ${mobileTokens.sizes.headerHeight};
			flex-shrink: 0;
			border-bottom: 1px solid ${mobileTokens.colors.border};
			background: ${mobileTokens.colors.background};
		`,

		// Header left section (back button + title)
		headerLeft: css`
			display: flex;
			align-items: center;
			flex: 1;
			min-width: 0;
		`,

		// Back button
		backButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			border-radius: 8px;
			background: transparent;
			border: none;
			cursor: pointer;
			transition: all 0.2s ease;
			margin-right: 12px;
			color: ${mobileTokens.colors.text};

			&:active {
				background: ${mobileTokens.colors.selectedBackground};
				transform: scale(0.95);
			}
		`,

		// Header title
		headerTitle: css`
			font-size: ${mobileTokens.fonts.header.fontSize};
			font-weight: ${mobileTokens.fonts.header.fontWeight};
			line-height: ${mobileTokens.fonts.header.lineHeight};
			color: ${mobileTokens.colors.text};
			margin: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		// Close button
		closeButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			border-radius: 8px;
			background: transparent;
			border: none;
			cursor: pointer;
			transition: all 0.2s ease;
			color: ${mobileTokens.colors.secondaryText};

			&:active {
				background: ${token.colorFillQuaternary};
				transform: scale(0.95);
			}
		`,

		// Search section
		searchSection: css`
			padding: 12px 16px;
			border-bottom: 1px solid ${mobileTokens.colors.border};
			background: ${mobileTokens.colors.background};
		`,

		// Search input wrapper
		searchInputWrapper: css`
			position: relative;
			display: flex;
			align-items: center;
			background: ${token.colorFillQuaternary};
			border: 1px solid ${mobileTokens.colors.border};
			border-radius: 8px;
			padding: 8px 12px;
			transition: all 0.2s ease;

			&:focus-within {
				border-color: ${token.colorPrimary};
				box-shadow: 0 0 0 2px ${token.colorPrimary}1A;
			}
		`,

		// Search input
		searchInput: css`
			flex: 1;
			background: transparent;
			border: none;
			outline: none;
			font-size: 16px;
			font-family: ${mobileTokens.fonts.primary};
			color: ${mobileTokens.colors.text};
			line-height: 22px;
			min-height: 22px;

			&::placeholder {
				color: ${mobileTokens.colors.hintText};
			}

			/* Prevent iOS zoom on focus */
			@media (max-width: 768px) {
				font-size: 16px;
			}
		`,

		// Search icon
		searchIcon: css`
			margin-right: 8px;
			color: ${mobileTokens.colors.hintText};
			flex-shrink: 0;
		`,

		// Clear button
		clearButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			border-radius: 10px;
			background: ${mobileTokens.colors.hintText};
			border: none;
			cursor: pointer;
			margin-left: 8px;
			transition: all 0.2s ease;

			&:active {
				transform: scale(0.9);
			}
		`,

		// Search query display (for showing current search)
		searchQuery: css`
			font-size: ${mobileTokens.fonts.hintText.fontSize};
			color: ${mobileTokens.colors.hintText};
			line-height: ${mobileTokens.fonts.hintText.lineHeight};
			padding: 4px 0;
		`,

		// Content section
		content: css`
			flex: 1;
			overflow: hidden;
			display: flex;
			flex-direction: column;
		`,

		// Menu list
		menuList: css`
			flex: 1;
			overflow: hidden;
			padding: ${mobileTokens.spacing.contentPadding};
			padding-top: 8px;
			padding-bottom: 8px;
		`,

		title: css`
			font-size: 14px;
			line-height: 16px;
			padding: ${mobileTokens.spacing.itemPadding};
			overflow: hidden;
			color: ${mobileTokens.colors.text};
			text-overflow: ellipsis;

			font-family: "PingFang SC";
			font-style: normal;
			font-weight: 400;
		`,

		divider: css`
			height: 1px;
			background-color: ${mobileTokens.colors.border};
			margin: ${mobileTokens.spacing.itemPadding};
		`,

		// Menu item
		menuItem: css`
			display: flex;
			align-items: center;
			gap: 8px;
			padding: ${mobileTokens.spacing.itemPadding};
			border-radius: ${mobileTokens.sizes.itemBorderRadius};
			cursor: pointer;
			transition: all 0.2s ease;
			min-height: ${mobileTokens.sizes.itemHeight};
			margin-bottom: 4px;

			&:active {
				background: ${mobileTokens.colors.selectedBackground};
				transform: scale(0.98);
			}

			&:last-child {
				margin-bottom: 0;
			}

			&.last-history-item {
				margin-bottom: 8px;
				position: relative;

				&::after {
					content: "";
					position: absolute;
					bottom: -4px;
					left: 0;
					display: block;
					width: 100%;
					height: 1px;
					background-color: ${mobileTokens.colors.border};
				}
			}
		`,

		// Menu item icon
		menuItemIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: ${mobileTokens.sizes.iconSize};
			height: ${mobileTokens.sizes.iconSize};
			flex-shrink: 0;
			font-size: 16px;

			&:empty {
				display: none;
			}

			&.mcp-icon {
				border-radius: 4px;
				color: white;
			}

			&.agent-icon {
				border-radius: 4px;
				color: white;
			}

			&.folder-icon {
				color: ${token.colorPrimary};
			}
		`,

		// Menu item content
		menuItemContent: css`
			display: flex;
			flex-direction: column;
			flex: 1;
			min-width: 0;
			gap: 2px;
		`,

		// Menu item title
		menuItemTitle: css`
			font-size: ${mobileTokens.fonts.itemTitle.fontSize};
			font-weight: ${mobileTokens.fonts.itemTitle.fontWeight};
			line-height: ${mobileTokens.fonts.itemTitle.lineHeight};
			color: ${mobileTokens.colors.text};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		// Menu item description
		menuItemDescription: css`
			font-size: ${mobileTokens.fonts.itemDescription.fontSize};
			font-weight: ${mobileTokens.fonts.itemDescription.fontWeight};
			line-height: ${mobileTokens.fonts.itemDescription.lineHeight};
			color: ${mobileTokens.colors.hintText};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		`,

		// Delete button for history items
		deleteButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			flex-shrink: 0;
			color: ${mobileTokens.colors.text};
			font-size: 16px;
			border-radius: 4px;
			cursor: pointer;
			transition: all 0.2s ease;

			&:hover {
				background: ${mobileTokens.hover.itemHoverBg};
				color: ${mobileTokens.colors.secondaryText};
			}
		`,

		// Right arrow icon
		rightArrow: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			flex-shrink: 0;
			color: ${mobileTokens.colors.secondaryText};
			font-size: 14px;
			border-radius: 4px;

			&:hover {
				background: ${mobileTokens.hover.itemHoverBg};
				color: ${mobileTokens.colors.secondaryText};
			}
		`,

		// Loading state
		loading: css`
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			color: ${mobileTokens.colors.hintText};
			font-size: ${mobileTokens.fonts.itemTitle.fontSize};
			text-align: center;
		`,

		// Empty state
		empty: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 60px 20px;
			color: ${mobileTokens.colors.hintText};
			font-size: ${mobileTokens.fonts.itemTitle.fontSize};
			text-align: center;
		`,

		// Error state
		error: css`
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 40px 20px;
			color: ${token.colorError};
			font-size: ${mobileTokens.fonts.itemTitle.fontSize};
			text-align: center;
		`,

		// Retry button
		retryButton: css`
			margin-top: 16px;
			padding: 8px 16px;
			border: 1px solid ${mobileTokens.colors.border};
			border-radius: 6px;
			background: ${mobileTokens.colors.background};
			color: ${mobileTokens.colors.text};
			font-size: ${mobileTokens.fonts.hintText.fontSize};
			cursor: pointer;
			transition: all 0.2s ease;

			&:active {
				background: ${token.colorFillQuaternary};
				transform: scale(0.98);
			}
		`,

		// Bottom safe area
		bottomSafeArea: css`
			height: ${mobileTokens.spacing.bottomSafeArea};
			background: ${mobileTokens.colors.background};
			flex-shrink: 0;
		`,

		// Virtuoso container
		virtuosoContainer: css`
			height: 100%;
			width: 100%;

			/* Custom scrollbar */
			.virtuoso-scroll-viewport {
				&::-webkit-scrollbar {
					width: 2px;
				}

				&::-webkit-scrollbar-thumb {
					background: ${mobileTokens.colors.border};
					border-radius: 1px;
				}

				&::-webkit-scrollbar-track {
					background: transparent;
				}
			}
		`,

		// Responsive breakpoints
		responsiveContent: css`
			/* For very small screens */
			@media (max-width: 375px) {
				.${css`menuItem`} {
					padding: 10px 12px;
				}

				.${css`headerTitle`} {
					font-size: 16px;
				}
			}

			/* For landscape orientation */
			@media (orientation: landscape) and (max-height: 500px) {
				.${css`popupBody`} {
					max-height: 95vh;
				}
			}
		`,

		typeDescription: css`
			font-size: ${mobileTokens.fonts.hintText.fontSize};
			color: ${mobileTokens.colors.hintText};
			line-height: ${mobileTokens.fonts.hintText.lineHeight};
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-width: 50%;
		`,
		typeDescriptionContent: css`
			direction: ltr;
			unicode-bidi: bidi-override;
		`,
	}
})

// Export additional style utilities for mobile
export const getMobileItemIconStyle = (type: string) => {
	switch (type) {
		case "mcp":
			return "mcp-icon"
		case "agent":
			return "agent-icon"
		case "folder":
			return "folder-icon"
		default:
			return ""
	}
}

export const getMobileStateTitle = (state: string, t?: any) => {
	if (!t) {
		// Fallback for backwards compatibility
		switch (state) {
			case "search":
				return "搜索结果"
			case "folder":
				return "文件夹"
			case "mcp":
				return "MCP 扩展"
			case "agent":
				return "智能体"
			case "skills":
				return "技能"
			default:
				return "选择引用内容"
		}
	}

	// Use translations when available
	switch (state) {
		case "search":
			return t.searchResults
		case "folder":
			return t.panelTitles?.folder || "Folder"
		case "mcp":
			return t.panelTitles?.mcp || "MCP Extensions"
		case "agent":
			return t.panelTitles?.agent || "Agents"
		case "skills":
			return t.panelTitles?.skills || "Skills"
		default:
			return t.selectItem || "Select Item"
	}
}
