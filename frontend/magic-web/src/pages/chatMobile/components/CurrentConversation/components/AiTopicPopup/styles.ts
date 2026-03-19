import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	body: {
		"--adm-color-background": token.colorBgContainer,
	},
	container: css`
		background-color: ${token.colorBgContainer};
		position: relative;
		height: fit-content;
		max-height: 80vh;
	`,
	// Header styles - following Figma design
	header: css`
		padding: 12px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 48px;
		background-color: ${token.magicColorUsages?.bg?.[0]};
		border-bottom: 1px solid ${token.magicColorUsages?.border || "rgba(28, 29, 35, 0.08)"};
	`,
	iconWrapper: css`
		width: 24px;
		height: 24px;
		border-radius: 4px;
		background-color: ${token.colorPrimary};
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		svg {
			width: 18px;
			height: 18px;
			color: #ffffff;
		}
	`,
	headerTitle: css`
		flex: 1;
		color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		font-size: 18px;
		font-weight: 600;
		line-height: 24px;
		margin: 0;
	`,
	closeButton: css`
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: opacity 0.2s;

		&:active {
			opacity: 0.7;
		}

		svg {
			width: 24px;
			height: 24px;
			color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		}
	`,
	// List container
	listContainer: css`
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
	`,
	// SwipeAction wrapper
	swipeAction: css`
		.adm-swipe-action-action-button {
			--adm-color-primary: #315cec;
			--adm-color-danger: #ff4d3a;

			color: #ffffff;
			font-family:
				"PingFang SC",
				-apple-system,
				BlinkMacSystemFont,
				sans-serif;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 60px;
			height: 100%;
			border: none;
			border-radius: 0;
		}

		.adm-swipe-action-action-button:first-of-type {
			background-color: #315cec !important;
		}

		.adm-swipe-action-action-button:last-of-type {
			background-color: #ff4d3a !important;
		}
	`,
	// List item styles following Figma design
	listItem: css`
		--padding-left: 0;
		background-color: ${token.colorBgContainer};

		.adm-list-item-content {
			padding: 0;
			min-height: 42px;
			background-color: ${token.colorBgContainer};
			border-top: none;
		}

		.adm-list-item-content-main {
			padding: 0;
		}

		.adm-list-item-content-arrow {
			display: none;
		}
	`,
	itemContent: css`
		height: 42px;
		margin: 4px 6px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		background-color: ${token.colorBgContainer};
		border-radius: 8px;

		&.active {
			background-color: ${token.magicColorUsages.primaryLight.default};
		}
	`,
	itemIcon: css`
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;

		svg {
			width: 24px;
			height: 24px;
			color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		}
	`,
	itemTitle: css`
		flex: 1;
		color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	itemRight: css`
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.magicColorUsages?.primary?.default};
	`,
	dragIcon: css`
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;

		svg {
			width: 20px;
			height: 20px;
			color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.5)"};
			opacity: 0.6;
		}
	`,
	newTopicBadge: css`
		background-color: #fadb14;
		color: #000000;
		padding: 2px 8px;
		border-radius: 12px;
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 12px;
		font-weight: 500;
		line-height: 16px;
		margin-left: 8px;
		white-space: nowrap;
	`,
	topicList: css`
		height: calc(60vh - 100px);
		margin-bottom: 66px;
		--border-bottom: transparent !important;
		--border-top: transparent !important;
		background-color: ${token.colorBgContainer};
		overflow-y: auto;
		overflow-x: hidden;

		.adm-list {
			background-color: ${token.colorBgContainer};
		}
		.adm-list-body-inner {
			overflow-y: auto;
			height: 100%;
		}
	`,

	topicTitleText: css`
		color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	topicSubtitle: css`
		color: ${token.magicColorUsages?.text?.[3] || "rgba(28, 29, 35, 0.5)"};
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		text-align: center;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	// Action sheet styles
	actionItem: css`
		height: 50px;
		padding: 0 20px;
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: opacity 0.2s;
		background-color: ${token.colorBgContainer};
		color: ${token.magicColorUsages?.text?.[0] || "rgba(28, 29, 35, 0.8)"};
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;

		&:active {
			opacity: 0.7;
		}

		&:not(:last-child) {
			border-bottom: 1px solid ${token.magicColorUsages?.border || "rgba(28, 29, 35, 0.08)"};
		}
	`,
	deleteIcon: css`
		color: #ff4d3a !important;
	`,
	deleteText: css`
		color: #ff4d3a;
	`,
	// Button styles
	cancelButtonWrapper: css`
		padding: 12px;
		background-color: ${token.colorBgContainer};
	`,
	cancelButton: css`
		display: flex;
		height: 42px;
		justify-content: center;
		align-items: center;
		gap: 8px;
		border-radius: 8px;
		border: none;
		background-color: ${token.magicColorUsages?.fill?.[0] || "rgba(28, 29, 35, 0.04)"};
	`,
	createTopicButtonWrapper: css`
		padding: 12px;
		background-color: ${token.colorBgContainer};
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
	`,
	createTopicButton: css`
		display: flex;
		height: 42px;
		justify-content: center;
		align-items: center;
		border-radius: 8px;
		color: ${token.magicColorUsages?.text?.[1]};
		font-family:
			"PingFang SC",
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	// New topic item special styling
	newTopicItem: css`
		cursor: pointer;
		transition: opacity 0.2s;

		&:active {
			opacity: 0.7;
		}

		.adm-list-item-content {
			background-color: ${token.colorBgContainer};
		}
	`,
	// Responsive adjustments
	"@media (max-width: 375px)": {
		header: {
			padding: "10px 12px",
		},
		itemContent: {
			padding: "0 10px",
		},
	},
	topicHeaderWrapper: css`
		padding: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid ${token.magicColorUsages?.border || "rgba(28, 29, 35, 0.08)"};
	`,
	topicHeader: css`
		flex-shrink: 0;
		background-color: ${token.colorBgContainer};
	`,
	topicTitle: css`
		margin-bottom: 8px;
		text-align: center;
		flex: 1;
	`,
	topicIconWrapper: css`
		display: flex;
		width: 40px;
		height: 40px;
		justify-content: center;
		align-items: center;
		gap: 16.667px;
		background-color: ${token.colorPrimary};
		color: ${token.colorBgContainer};
		border-radius: 8px;
		flex-shrink: 0;
	`,
}))
