import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		wrapper: css`
			border-radius: 10px;
			position: relative;
			overflow: hidden;
			display: inline-block;
		`,
		button: css`
			cursor: pointer;
			border: none;
			padding: 0;
			width: 100%;
			height: 100%;
			& svg {
				width: 100%;
			}
		`,
		image: css`
			width: 100%;
			height: 100%;
			object-fit: cover;
			max-width: 240px;
			max-height: 240px;
		`,
		imageLoadError: css`
			cursor: pointer;
			border: 1px solid ${token.colorBorderSecondary};
			border-radius: 4px;
			background-color: ${token.magicColorUsages.bg[1]};
			width: fit-content;
			padding: 2px 4px;
			gap: 4px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			transition: background-color 0.1s ease-in-out;
			flex-wrap: nowrap;
			overflow: hidden;
			white-space: nowrap;

			.reload-button {
				padding: 0;
				border: none;
			}

			&:hover {
				background-color: ${token.magicColorScales.grey[0]};
			}
		`,
		longImage: css`
			width: 180px;
			height: 320px;
			object-fit: cover;
			max-height: unset !important;
		`,
		longImageTip: css`
			position: absolute;
			top: 10px;
			right: 10px;
			background: rgba(0, 0, 0, 0.5);
			color: #fff;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			display: flex;
			height: 20px;
			padding: 2px 8px;
			flex-direction: column;
			align-items: flex-start;
			border-radius: 3px;
		`,
		skeletonImage: css`
			width: 100% !important;
			height: 100%;
			.${prefixCls}-skeleton-image {
				width: 100% !important;
				height: 100% !important;
				min-width: 96px !important;
				min-height: 96px !important;
			}
		`,
	}
})
