import { createStyles } from "antd-style"

export const useTopicItemStyles = createStyles(({ css, cx, token }) => {
	const menu = cx(css`
		visibility: hidden;
		height: 20px;
	`)

	return {
		container: css`
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
		`,
		menu,
	}
})
