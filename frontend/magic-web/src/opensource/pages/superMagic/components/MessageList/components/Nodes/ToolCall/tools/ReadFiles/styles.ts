import { createStyles } from "antd-style"

export const useStyle = createStyles(({ css, token }) => {
	return {
		node: css`
			width: 100%;
			height: fit-content;
			overflow: hidden;
			flex: none;
			padding: 5px 0;
		`,
		nodeHeader: css`
			width: 100%;
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		container: css`
			max-width: 100%;
			width: fit-content;
			display: inline-flex;
			flex-direction: column;
			align-items: center;
			overflow: hidden;
			border-radius: 8px;
			box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
			border: 1px solid #e5e5e5;
		`,
		containerActive: css`
			width: 100%;
		`,
		tag: css`
			width: fit-content;
			height: 28px;
			display: inline-flex;
			padding: 6px 0 6px 6px;
			align-items: center;
			overflow: hidden;
			gap: 6px;
			border-radius: 8px;
			background-color: #fff;
			cursor: pointer;
		`,
		tagDisabled: css`
			cursor: not-allowed;
		`,
		tagIcon: css`
			width: 20px;
			height: 20px;
			flex: none;

			img {
				vertical-align: top;
			}
		`,
		tagLabel: css`
			width: fit-content;
			flex: none;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		button: css`
			width: 20px;
			height: 20px;
			border-radius: ${token.borderRadiusSM}px;
			flex: none;
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			margin-left: auto;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		buttonIcon: css`
			transition: all linear 0.1s;
		`,
		buttonIconActive: css`
			transform: rotate(180deg);
		`,
		tip: css`
			font-size: 12px;
			line-height: 16px;
			flex-shrink: 1;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			min-width: 0;
		`,
		cardNode: css`
			padding: 0 6px 6px 6px;
			margin: 0;
			position: relative;
			border-radius: 0 0 8px 8px;
			width: 100%;
			max-height: 220px;
			overflow: hidden;

			&::after {
				content: "";
				position: absolute;
				bottom: 0;
				left: 0;
				width: 100%;
				height: 60%;
				background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0.83%, #f9f9f9 100%);
				border-radius: 0 0 8px 8px;
			}
		`,
	}
})
