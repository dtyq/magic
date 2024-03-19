import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, cx, prefixCls, token }) => {
	const mainWrapper = cx(css`
		max-width: 100%;
		overflow: hidden;
	`)

	const time = cx(css`
		max-width: 50px;
		width: fit-content;
		color: ${token.magicColorUsages.text[3]};
		text-align: right;
		white-space: nowrap;
		overflow-x: hidden;
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		user-select: none;
		flex-shrink: 0;
	`)

	const moreButton = css`
			--${prefixCls}-button-text-hover-bg: ${token.magicColorUsages.fill[0]} !important;
			user-select: none;
		`

	const content = cx(css`
		width: 100%;
		overflow: hidden;
		color: ${token.colorTextQuaternary};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		max-height: 18px;
		overflow: hidden;
		user-select: none;
		text-overflow: ellipsis;
		white-space: nowrap;

		&:empty {
			display: none;
		}
	`)

	const topFlag = css`
		position: relative;
		&::before {
			content: "";
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			width: 0px;
			height: 0px;
			border-bottom: 8px solid transparent;
			border-left: 8px solid ${token.magicColorUsages.fill[1]};
		}
	`

	const extra = cx(css`
		color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[1]};
		cursor: pointer;
		display: none;
		flex-shrink: 0;
		max-height: 100%;
		overflow: hidden;
	`)

	return {
		container: css`
			user-select: none;
			padding: 10px;
			border-radius: 8px;
			margin: 0 8px;

			&.active {
				background-color: ${token.magicColorUsages.primaryLight.default};
			}

			&:hover {
				cursor: pointer;

				&:not(.active) {
					background-color: ${token.magicColorScales.grey[0]};
				}

				.${time} {
					display: none;
				}

				.${extra} {
					display: block;
				}
			}
		`,
		topFlag,
		top: css`
			width: 100%;
			flex: 1;
			user-select: none;
		`,
		title: css`
			white-space: nowrap;
			overflow-x: hidden;
			text-overflow: ellipsis;
			user-select: none;
		`,
		mainWrapper,
		content,
		time,
		moreButton,
		extra,
	}
})
