import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		select: css`
			width: 100%;
		`,
		tag: css`
			background-color: ${token.magicColorUsages.fill[0]};
			display: flex;
			gap: 4px;
			align-items: center;
			border-radius: 4px;
		`,
		label: css`
			font-size: 12px;
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: break-spaces;
			color: ${token.magicColorUsages.text[0]};
			-webkit-box-orient: vertical;
			display: -webkit-box;
			-webkit-line-clamp: 1;
			line-clamp: 1;
		`,
		options: css`
			max-height: 200px;
			overflow-y: auto;
			scrollbar-width: none;
			display: flex;
			flex-direction: column;
			gap: 4px;
		`,
		maxTag: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		maxTagAvatars: css`
			display: flex;
			align-items: center;
		`,
		maxTagAvatar: css`
			margin-left: -6px;
			border: 1px solid ${token.colorBgContainer};
			&:first-of-type {
				margin-left: 0;
			}
		`,
		maxTagCount: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[1]};
			line-height: 1;
		`,
		allCheck: css`
			padding-top: 4px;
			border-top: 1px solid ${token.magicColorUsages.border};
		`,
	}
})
