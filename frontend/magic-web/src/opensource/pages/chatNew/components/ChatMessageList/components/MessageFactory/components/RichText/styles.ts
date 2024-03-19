import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }, { emojiSize }: { emojiSize: number }) => ({
	container: css`
		outline: none;
		height: auto;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	`,
	p: css`
		p {
			margin-bottom: 0;
		}
	`,
	image: css`
		img {
			max-width: 240px;
			max-height: 240px;
			object-fit: contain;
			cursor: pointer;

			&:not(.magic-emoji) {
				display: block;
			}

			@media (max-width: 768px) {
				max-width: 100%;
			}
		}
	`,
	mention: css`
		color: ${token.colorPrimary};
	`,
	emoji: css`
		.magic-emoji {
			width: ${emojiSize}px !important;
			height: ${emojiSize}px !important;
			position: relative;
			top: -2px;
			display: inline;
		}
	`,
	error: css`
		color: ${token.colorError};
		margin-top: 8px;
		font-size: 14px;
	`,
	quickInstruction: css`
		.quick-instruction {
			background-color: ${token.magicColorUsages.primaryLight.hover};
			color: ${token.magicColorUsages.primary.default};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			padding: 2px 6px;
			margin: 0 4px;
			border-radius: 6px;
			user-select: none;
			display: inline-block;
			cursor: pointer;

			&[data-hidden="true"] {
				font-size: 9px;
				padding: 1px 4px;
				line-height: 14px;
				margin: 0 2px;
				transform: translate(-1px, -1px);
			}
		}
	`,
}))

export default useStyles
