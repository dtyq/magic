import { createStyles, keyframes } from "antd-style"

// Locate file blink animation - matches TopicFilesCore style
const locateFileBlinkAnimation = keyframes`
	0%, 100% {
		background-color: transparent;
	}
	50% {
		background-color: #EEF3FD;
	}
`

export default createStyles(({ token, css }) => ({
	container: css`
		width: 248px;
		background: ${token.colorBgContainer};
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		height: 100%;
		border-radius: 0 0 0 10px;
		border-right: 1px solid ${token.colorBorder};
	`,

	containerMobile: css`
		width: 100%;
		border-right: none;
		padding: 0;
	`,

	searchBox: css`
		width: 100%;
		height: 28px;

		.ant-input {
			font-size: 12px;
			line-height: 16px;
		}
	`,

	treeArea: css`
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;

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

		.magic-file-title {
			height: 32px;
		}
	`,

	fileItem: css`
		position: relative;
		display: flex;
		align-items: center;
		cursor: pointer;
		border-radius: 8px;
		transition: background 0.2s;
		padding-left: 4px;

		&:hover {
			background: ${token.colorBgTextHover};
		}
	`,

	mobileFileItem: css`
		height: 40px;
	`,

	fileTitle: css`
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		height: 28px;
		padding: 6px 8px 6px 4px;
	`,
	mobileFileTitle: css`
		gap: 6px;
	`,

	iconWrapper: css`
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		img {
			flex-shrink: 0;
		}
	`,

	fileName: css`
		flex: 1;
		font-size: 14px;
		line-height: 20px;
		color: ${token.magicColorUsages.text[1]};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		user-select: none;
	`,

	mobileFileName: css`
		font-size: 14px !important;
		line-height: 20px !important;
	`,

	emptyState: css`
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		font-size: 12px;
		line-height: 16px;
		color: ${token.colorTextTertiary};
		padding: 20px;
		text-align: center;
	`,

	defaultOpenIconWrapper: css`
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-left: auto;
		padding: 2px;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;

		&:hover {
			background: ${token.magicColorUsages?.fill?.[0] || token.colorFillTertiary};
		}
	`,

	defaultOpenIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		stroke: ${token.magicColorUsages?.text?.[3]};
	`,

	defaultOpenIconActive: css`
		stroke: ${token.colorPrimary};
	`,

	// Locating file item style - with blinking animation
	locatingFileItem: css`
		animation: ${locateFileBlinkAnimation} 1s ease-in-out 2;
		border-radius: 8px;
	`,
}))
