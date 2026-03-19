import { createStyles } from "antd-style"

export const useCollapsedHeaderStyles = createStyles(({ token, css, prefixCls }) => ({
	collapsedHeader: css`
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		background: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		border-radius: ${token.borderRadius}px;
		box-shadow: ${token.boxShadowSecondary};
		cursor: grab;
		width: max-content;
		max-width: 400px;
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

	successIcon: css`
		color: ${token.colorSuccess};
	`,

	warningIcon: css`
		color: #ff7d00;
	`,

	errorIcon: css`
		color: ${token.colorError};
	`,

	statusContent: css`
		flex: 1;
		gap: 2px;
		min-width: 0;
	`,

	statusText: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[1]};
		line-height: 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`,

	progressText: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[1]};
		line-height: 16px;
	`,

	progressBar: css`
		width: 100px;
		display: flex;
		align-items: center;

		.${prefixCls}-progress-bg {
			height: 4px !important;
		}

		.${prefixCls}-progress-inner {
			height: 4px !important;
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
		color: #ff7d00;
		font-size: ${token.fontSizeSM}px;
		height: 18px;
		padding: 0 8px;
		border-radius: ${token.borderRadiusSM}px;
		transition: all ${token.motionDurationFast};
		background-color: #fff8eb;

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
	`,
}))

export default useCollapsedHeaderStyles
