import { createStyles } from "antd-style"

export const useCollapsedHeaderStyles = createStyles(({ token, css, prefixCls }) => ({
	collapsedHeader: css`
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: 12px;
		box-shadow: ${token.boxShadowSecondary};
		cursor: grab;
		width: max-content;
		max-width: calc(100vw - 24px);
		user-select: none;

		&:active {
			cursor: grabbing;
		}
	`,

	dragging: css`
		box-shadow: ${token.boxShadow};
		transform: rotate(2deg);
		cursor: grabbing;
	`,

	englishLayout: css`
		font-family: ${token.fontFamily};
	`,

	statusIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	`,
	progressIcon: css`
		color: ${token.colorPrimary};
		display: flex;
	`,
	pausedIcon: css`
		color: ${token.colorTextSecondary};
		display: flex;
	`,

	successIcon: css`
		color: ${token.colorSuccess};
	`,

	warningIcon: css`
		color: ${token.colorWarning};
	`,

	errorIcon: css`
		color: ${token.colorError};
	`,

	statusContent: css`
		flex: 1;
		flex-wrap: wrap;
		min-width: 0;
	`,

	statusText: css`
		font-size: 13px;
		color: ${token.magicColorUsages.text[1]};
		line-height: 20px;
		overflow-wrap: anywhere;
	`,

	progressText: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[1]};
		line-height: 16px;
		font-variant-numeric: tabular-nums;
	`,

	progressBar: css`
		width: 100px;
		display: flex;
		align-items: center;

		.${prefixCls}-progress-bg {
			height: 4px !important;
			background: ${token.colorPrimary};
		}

		.${prefixCls}-progress-inner {
			height: 4px !important;
			background: ${token.colorFillSecondary};
		}
	`,
	pausedProgress: css`
		.${prefixCls}-progress-bg {
			background: ${token.colorTextSecondary};
		}
	`,

	actions: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;

		.${prefixCls}-btn-icon {
			display: flex;
			align-items: center;
			justify-content: center;
		}

		/* 防止按钮区域触发拖拽 */
		* {
			cursor: pointer !important;
		}
	`,

	retryButton: css`
		color: ${token.colorWarning};
		font-size: ${token.fontSizeSM}px;
		height: 18px;
		padding: 0 8px;
		border-radius: ${token.borderRadiusSM}px;
		transition: all ${token.motionDurationFast};
		background-color: ${token.colorWarningBg};

		&:hover {
			opacity: 0.8;
		}
	`,

	actionButton: css`
		color: ${token.colorTextTertiary};
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: ${token.borderRadiusSM}px;
		transition: all ${token.motionDurationFast};

		&:hover {
			color: ${token.colorTextSecondary};
			background-color: ${token.colorBgTextHover};
		}

		&:active {
			color: ${token.colorText};
		}

		@media (pointer: coarse) {
			width: 44px;
			height: 44px;
		}
	`,
}))

export default useCollapsedHeaderStyles
