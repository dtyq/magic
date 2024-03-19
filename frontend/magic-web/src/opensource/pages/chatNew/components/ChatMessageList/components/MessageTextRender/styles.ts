import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css }, { lineClamp = 1 }: { lineClamp: number | false }) => ({
		content: css`
			padding: 0;
			margin-left: 1.5px;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			display: inline-block;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			display: -webkit-box;
			${lineClamp !== false && `-webkit-line-clamp: ${lineClamp};`}
			-webkit-box-orient: vertical;
			user-select: none;

			strong {
				font-weight: 400 !important;
			}

			* {
				word-break: break-all;
				text-align: left;
			}

			[data-type="magic-emoji"] {
				width: 16px;
				height: 16px;
			}

			.ProseMirror {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				display: -webkit-box;
				${lineClamp !== false && `-webkit-line-clamp: ${lineClamp};`}
				-webkit-box-orient: vertical;
			}
		`,
		aiImageText: css`
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			max-height: 30px;
			max-width: var(--message-max-width);
		`,
	}),
)
