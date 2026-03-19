import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, responsive }) => ({
	overlay: css`
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		visibility: hidden;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		backdrop-filter: blur(0px);

		&.visible {
			opacity: 1;
			visibility: visible;
			background: rgba(0, 0, 0, 0.85);
			backdrop-filter: blur(8px);
		}

		${responsive.mobile} {
			/* Ensure it covers the entire mobile viewport */
			width: 100%;
			height: 100%;
		}
	`,

	container: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		position: relative;
		padding: 20px;
		box-sizing: border-box;
		overflow: hidden;
	`,

	imageWrapper: css`
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	`,

	image: css`
		max-width: 90vw;
		max-height: 70vh;
		width: auto;
		height: auto;
		object-fit: contain;
		transform: scale(0.7) translateY(30px);
		opacity: 0;
		filter: blur(4px);
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		transition-delay: 0.05s;
		transform-origin: center;
		user-select: none;
		-webkit-user-select: none;
		pointer-events: none;

		.visible & {
			transform: scale(1) translateY(0px);
			opacity: 1;
			filter: blur(0px);
		}

		&.interactive {
			transition: none;
			pointer-events: auto;
		}

		${responsive.mobile} {
			max-width: 269.707px;
			max-height: 480px;
		}
	`,

	closeButton: css`
		position: absolute;
		bottom: 30px;
		left: 50%;
		transform: translateX(-50%) translateY(50px) scale(0.5);
		width: 40px;
		height: 40px;
		border-radius: 1000px;
		background: rgba(255, 255, 255, 0);
		border: 1px solid rgba(255, 255, 255, 0);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(0px);
		transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
		transition-delay: 0.15s;
		opacity: 0;
		transform-origin: center;
		z-index: 10;

		.visible & {
			transform: translateX(-50%) translateY(0px) scale(1);
			background: rgba(255, 255, 255, 0.1);
			border: 1px solid rgba(255, 255, 255, 0.3);
			backdrop-filter: blur(10px);
			opacity: 1;
		}

		&:hover {
			background: rgba(255, 255, 255, 0.2);
			border-color: rgba(255, 255, 255, 0.5);
			transform: translateX(-50%) translateY(0px) scale(1.1);
		}

		&:active {
			transform: translateX(-50%) translateY(0px) scale(0.95);
			background: rgba(255, 255, 255, 0.3);
		}

		${responsive.mobile} {
			left: 50%;

			&:hover {
				transform: translateX(-50%) translateY(0px) scale(1.1);
			}

			&:active {
				transform: translateX(-50%) translateY(0px) scale(0.95);
			}
		}
	`,

	closeIcon: css`
		transition: all 0.2s ease;
		transform: rotate(0deg);

		.visible & {
			transform: rotate(180deg);
		}
	`,

	scaleIndicator: css`
		position: absolute;
		top: 50px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 4px 12px;
		border-radius: 16px;
		font-size: 12px;
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
		z-index: 10;

		&.visible {
			opacity: 1;
		}
	`,
}))
