import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		position: relative;
		user-select: none;
	`,
	overlay: css`
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		background-size: cover;
		background-position: center;
		z-index: 1;
		overflow: hidden;
	`,
	imageWrapper: css`
		width: 100%;
		height: 100%;
		position: relative;
	`,
	image: css`
		display: block;
		height: 100%;
		object-fit: cover;
	`,
	text: css`
		border-radius: 3px;
		background-color: rgba(0, 0, 0, 0.5);
		color: #fff;
		width: 52px;
		height: 20px;
		font-size: 12px;
		text-align: center;
		position: absolute;
		top: 10px;
		left: 10px;
		text-wrap-mode: nowrap;
	`,
	textRight: css`
		left: auto;
		right: 10px;
	`,
	slider: css`
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 2;
	`,
	sliderSplit: css`
		height: 100%;
		width: 2px;
		background-color: #fff;
		position: absolute;
		left: 50%;
	`,
	sliderHandle: css`
		position: absolute;
		top: 50%;
		left: 50%;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		color: ${token.magicColorUsages.black};
		cursor: ew-resize;
		background-color: #fff;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
	`,
}))
