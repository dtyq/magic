import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	popupBody: css`
		padding: 0;
		border-radius: 0;
		height: 100%;
		width: 100vw;
		--adm-color-background: rgba(0, 0, 0, 0.8);
		padding-bottom: 0 !important;

		@keyframes fadeIn {
			from {
				background-color: transparent;
			}
			to {
				background-color: rgba(0, 0, 0, 0.8);
			}
		}

		@keyframes fadeOut {
			from {
				background-color: rgba(0, 0, 0, 0.8);
			}
			to {
				background-color: transparent;
			}
		}
	`,

	container: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100vw;
		position: relative;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	`,

	imageContainer: css`
		flex: 1;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	`,

	imagePreview: css`
		height: 100%;
		position: relative;
	`,

	actionBarContainer: css`
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
		padding: 20px 16px calc(20px + ${token.safeAreaInsetBottom}) 16px;
		z-index: 100;
	`,

	actionBar: css`
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding: 12px 0;
	`,

	actionButton: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		background: none;
		border: none;
		color: #fff;
		cursor: pointer;
		padding: 8px;
		border-radius: 8px;
		min-width: 60px;

		&:active {
			background: rgba(255, 255, 255, 0.1);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	`,

	actionIcon: css`
		font-size: 20px;
	`,

	actionText: css`
		color: ${token.magicColorUsages?.white || "#fff"};
		font-size: 10px;
		font-weight: 400;
		line-height: 11px;
	`,

	imageViewer: css`
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		touch-action: none;
		overflow: hidden;
	`,

	image: css`
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		user-select: none;
		-webkit-user-drag: none;
		touch-action: none;
		pointer-events: none;
		will-change: transform;
	`,

	svgContainer: css`
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
		touch-action: none;
		pointer-events: none;
		will-change: transform;

		& svg {
			max-width: 100%;
			max-height: 100%;
			width: auto;
			height: auto;
			object-fit: contain;
			background: #fff;
			user-select: none;
			-webkit-user-select: none;
		}

		/* Handle SVG content rendered as HTML */
		& > * {
			max-width: 100%;
			max-height: 100%;
			user-select: none;
			-webkit-user-select: none;
		}
	`,

	loadingContainer: css`
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		color: #fff;
		z-index: 10;
	`,

	progressContainer: css`
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	`,

	progressText: css`
		color: #fff;
		font-size: 14px;
	`,

	closeButton: css`
		position: absolute;
		top: calc(${token.safeAreaInsetTop} + 20px);
		right: 16px;
		background: rgba(0, 0, 0, 0.5);
		border: none;
		border-radius: 20px;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 18px;
		cursor: pointer;
		z-index: 101;

		&:active {
			background: rgba(0, 0, 0, 0.7);
		}
	`,

	emptyContainer: css`
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #fff;
	`,
}))
