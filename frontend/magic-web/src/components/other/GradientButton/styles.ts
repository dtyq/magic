import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	const gradient = "linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%)"

	return {
		wrapper: css`
			position: relative;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 1px;
			border: none;
			background: transparent;
			cursor: pointer;
			border-radius: 4px;
			transition: all 0.2s ease;

			&::before {
				content: "";
				position: absolute;
				inset: 0;
				border-radius: 4px;
				padding: 1px;
				background: ${gradient};
				mask:
					linear-gradient(#fff 0 0) content-box,
					linear-gradient(#fff 0 0);
				mask-composite: xor;
				-webkit-mask:
					linear-gradient(#fff 0 0) content-box,
					linear-gradient(#fff 0 0);
				-webkit-mask-composite: xor;
				pointer-events: none;
			}

			&:hover {
				opacity: 0.8;
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		`,

		content: css`
			position: relative;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 2px;
			width: 100%;
			height: 100%;
			border-radius: 7px;
			z-index: 1;
		`,

		text: css`
			background: ${gradient};
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		`,

		iconWrapper: css`
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			position: relative;

			svg {
				display: block;
			}

			/* Apply gradient to icon SVG elements using CSS variable */
			svg path {
				stroke: var(--gradient-id) !important;
			}

			svg circle,
			svg rect,
			svg polygon,
			svg polyline,
			svg line,
			svg ellipse {
				stroke: var(--gradient-id) !important;
				fill: var(--gradient-id) !important;
			}
		`,
	}
})
