import { createStyles } from "antd-style"

export default createStyles(({ token, css }) => ({
	body: css`
		display: flex;
		height: calc(600px - 54px); /* Subtract header height */
		overflow: hidden;
	`,

	fileListSection: css`
		flex-shrink: 0;
		border-right: 1px solid ${token.colorBorder};
		position: relative;
		overflow: hidden;
	`,

	resizeHandle: css`
		position: absolute;
		top: 0;
		right: -4px;
		width: 8px;
		height: 100%;
		cursor: col-resize;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;

		&::before {
			content: "";
			position: absolute;
			inset: 0;
			z-index: 0;
			background: linear-gradient(
				to bottom,
				rgba(239, 246, 255, 0),
				rgba(210, 230, 255, 1),
				rgba(239, 246, 255, 0)
			);
			opacity: 0;
			transition: opacity 0.2s;
		}

		&:hover::before,
		&:active::before {
			opacity: 1;
		}

		& > .resize-bar {
			width: 1px;
			height: 20px;
			border-radius: 1px;
			background: ${token.colorTextQuaternary};
			transition: background-color 0.2s;
		}

		&:hover > .resize-bar,
		&:active > .resize-bar {
			background: ${token.colorPrimary};
		}
	`,
	fileSelector: css`
		height: calc(100% - 80px);
	`,

	shareOptionsSection: css`
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	`,

	selectedCountBar: css`
		padding: 12px;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[2]};
		flex-shrink: 0;
	`,

	divider: css`
		height: 1px;
		background: ${token.colorBorder};
		margin: 0 12px;
		flex-shrink: 0;
	`,

	selectorContainer: css`
		flex: 1;
		overflow-y: auto;
		padding: 12px;

		/* Custom scrollbar */
		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background: ${token.colorBorderSecondary};
			border-radius: 100px;
		}
	`,

	// Mobile styles
	mobileContainer: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	`,

	mobileHeader: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		background-color: #f9f9f9;
		flex-shrink: 0;
	`,

	mobileSelectedCount: css`
		font-size: 14px;
		line-height: 20px;
		color: rgba(28, 29, 35, 0.6);
	`,

	mobileSelectButton: css`
		display: flex;
		align-items: center;
		gap: 2px;
		cursor: pointer;
		color: ${token.colorPrimary};
		font-size: 14px;
		line-height: 20px;

		svg {
			stroke: ${token.colorPrimary};
		}
	`,

	mobileShareOptions: css`
		overflow-y: auto;
		padding: 12px;
		flex: 1;
		flex-shrink: 1;
	`,
}))
