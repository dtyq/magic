import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, prefixCls, token }) => ({
	container: css`
		width: 100%;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: ${token.magicColorScales.grey[0]};
	`,
	imageDragWrapper: css`
    width: 100%;
		height: 100%;
		--${prefixCls}-image-z-index-popup: 1000 !important;
		cursor: grab;
		user-select: none;
		touch-action: none;
	`,
	imageWrapper: css`
		height: 100%;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		transform-origin: center center;
		will-change: transform;
		backface-visibility: hidden;
	`,
	toolContainer: css`
		position: absolute;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.7);
		padding: 10px;
		z-index: 10;
		box-shadow:
			0 4px 14px 0 rgba(0, 0, 0, 0.1),
			0 0 1px 0 rgba(0, 0, 0, 0.3);
	`,
	toolButton: css`
		padding: 4px;
		border-radius: 6px;
		--${prefixCls}-color-link: ${token.colorWhite} !important;
		--${prefixCls}-color-link-hover: ${token.magicColorUsages.black};
		--${prefixCls}-color-text-disabled: rgba(255, 255, 255, 0.3);
		--${prefixCls}-color-link-active: ${token.magicColorUsages.black};

		&:not(:disabled):hover {
			color: ${token.magicColorUsages.black} !important;
			background-color: ${token.magicColorScales.grey[1]} !important;
		}

		&:not(:disabled):active {
			color: ${token.magicColorUsages.black} !important;
			background-color: ${token.magicColorScales.grey[2]} !important;
		}
	`,
	divider: css`
		width: 1px;
		height: 24px;
		display: block;
		background-color: rgba(255, 255, 255, 0.3);
	`,
	slider: css`
		width: 140px;

		/* Keep the complete toolbar within narrow mobile viewports. */
		@media (max-width: 768px) {
			width: 3.75rem;
		}

		--${prefixCls}-slider-track-bg: rgba(255, 255, 255, 0.5) !important;
		--${prefixCls}-slider-track-hover-bg: rgba(255, 255, 255, 0.5) !important;
		--${prefixCls}-slider-handle-color: ${token.colorWhite} !important;
		--${prefixCls}-slider-handle-hover-color: ${token.colorWhite} !important;
		--${prefixCls}-slider-handle-active-color: ${token.colorWhite} !important;
		--${prefixCls}-slider-dot-active-border-color: ${token.colorWhite} !important;
		--${prefixCls}-slider-handle-active-outline-color: transparent !important;
	`,
	sliderText: css`
		color: ${token.colorWhite};
		width: 40px;
		text-align: center;
		white-space: nowrap;
	`,
	segmented: css`
		border-radius: 8px;
		.${prefixCls}-segmented-group {
			display: flex;
			gap: 2px;
		}
		.${prefixCls}-segmented-item-label {
			padding: 4px;
		}
		.${prefixCls}-segmented-item {
			border-radius: 6px;
		}
		.${prefixCls}-segmented-item-selected {
			color: ${token.colorWhite};
			background-color: ${token.magicColorUsages.primary.default};
		}
		.${prefixCls}-segmented-item-icon {
			display: flex;
		}
	`,
	longPressButton: css`
		position: absolute;
		top: 40px;
		right: 20px;
		z-index: 99;
		border-radius: 8px;
		border: none;
		color: ${token.colorWhite};
		background-color: ${token.magicColorUsages.overlay.bg};
		padding: 4px 6px;
		&:hover,
		&:active {
			color: ${token.colorWhite} !important;
			background-color: ${token.magicColorScales.grey[4]} !important;
		}
	`,
	moreOperationsDropdown: css`
		&.${prefixCls}-dropdown-menu {
			padding: 10px;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.${prefixCls}-dropdown-menu-item {
			padding: 6px 10px;
		}
	`,
}))

export default useStyles
