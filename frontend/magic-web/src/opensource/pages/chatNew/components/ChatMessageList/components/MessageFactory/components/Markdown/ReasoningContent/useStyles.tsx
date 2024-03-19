import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	buttonWrapper: css`
		position: relative;
		width: fit-content;
		margin-bottom: 4px;
	`,
	expandedWrapper: css`
		position: relative;
		width: 100%;
		margin-bottom: 4px;
	`,
	contentContainer: css`
		max-height: 0;
		opacity: 0;
		overflow: hidden;
		transition:
			max-height 0.3s ease-in-out,
			opacity 0.3s ease-in-out;

		&.visible {
			opacity: 1;
			max-height: var(--content-max-height, 1000px);
		}
	`,
	markdown: css`
		color: ${token.magicColorUsages.text[2]};
		border-radius: 0;
		padding-left: 10px;
		border-left: 4px solid ${token.magicColorUsages.border};
		margin-top: 10px;
		transform: translateY(-10px);
		transition: transform 0.3s ease-in-out;

		.visible & {
			transform: translateY(0);
		}

		p {
			margin-bottom: 0.5em;
		}

		&:not(:last-child) {
			margin-bottom: 10px;
		}
	`,
	collapseTitle: css`
		font-size: 14px;
		font-weight: 500;
		color: ${token.magicColorUsages.text[2]};
		background-color: ${token.magicColorUsages.fill[0]};
		padding: 5px 10px;
		border-radius: 8px;
		width: fit-content;
		cursor: pointer;
		color: ${token.magicColorUsages.text[1]};
		text-align: justify;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		z-index: 1;
		position: relative;

		&:hover {
			background-color: ${token.magicColorUsages.fill[1]};
		}
	`,
}))
