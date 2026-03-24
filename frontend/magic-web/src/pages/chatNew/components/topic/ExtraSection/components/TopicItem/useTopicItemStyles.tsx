import { createStyles } from "antd-style"

export const useTopicItemStyles = createStyles(({ css, cx, token }) => {
	const menu = cx(css`
		visibility: hidden;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	`)

	return {
		container: css`
			width: 100%;
			padding: 10px;
			border-radius: 8px;
			cursor: pointer;

			&:hover {
				background: ${token.magicColorScales.grey[0]};

				.${menu} {
					visibility: visible;
				}
			}
		`,
		topicTitle: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: left;
			flex: 1;
		`,
		active: css`
			background: ${token.magicColorUsages.primaryLight.default};

			.${menu} {
				visibility: visible;
			}
		`,
		menuButton: css`
			width: 20px;
			height: 20px;
			padding: 0;
			border: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: transparent;
			cursor: pointer;
		`,
		menu,
	}
})
