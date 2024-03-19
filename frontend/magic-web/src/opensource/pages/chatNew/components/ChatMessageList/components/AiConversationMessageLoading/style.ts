import { createStyles, cx } from "antd-style"

import { calculateRelativeSize } from "@/opensource/utils/styles"

const useChatMessageStyles = createStyles(
	(
		{ css, isDarkMode, prefixCls, token },
		{
			self,
			fontSize,
			isMultipleCheckedMode,
		}: {
			self: boolean
			fontSize: number
			isMultipleCheckedMode: boolean
		},
	) => {
		const message = cx(css`
			width: 100%;
			border-radius: 12px;
			overflow-anchor: none;
			user-select: none;
		`)

		const content = cx(css`
			justify-content: flex-end;
			padding-right: unset;
			padding-left: 50px;
			width: 100%;
			box-sizing: border-box;
			user-select: none;
		`)

		const messageTop = cx(css`
			user-select: none;
		`)

		return {
			container: css`
				margin-top: ${calculateRelativeSize(12, fontSize)}px;
				flex-direction: row-reverse;
				align-self: flex-end;
				padding: 0 14px;
				user-select: none;

				> .${message} {
					align-items: flex-end;
				}

				${isMultipleCheckedMode
					? css`
							padding: 10px;
							border-radius: 12px;
							cursor: pointer;
							width: 100%;
							&:hover {
								background: ${isDarkMode
									? token.magicColorScales.grey[8]
									: token.magicColorUsages.primaryLight.default};
							}
						`
					: ""}
			`,
			blockContainer: css`
				width: 100%;
				.${prefixCls}-dropdown-trigger {
					width: 100%;
					& > div {
						width: 100%;
					}
				}
			`,
			reverse: css`
				flex-direction: row;
				align-self: flex-start;

				> .${message} {
					justify-content: flex-start;
					align-items: flex-start;
				}

				.${messageTop} {
					flex-direction: row-reverse;
				}

				.${content} {
					justify-content: flex-start;
					padding-left: unset;
					padding-right: 50px;
				}
			`,
			message,
			messageTop,
			content,
			time: css`
				color: ${token.magicColorUsages.text[3]};
				text-align: justify;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				font-weight: 400;
				line-height: ${calculateRelativeSize(16, fontSize)}px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				user-select: none;
			`,
			name: css`
				color: ${token.magicColorUsages.text[2]};
				text-align: justify;
				font-size: ${calculateRelativeSize(12, fontSize)}px;
				font-weight: 400;
				line-height: ${calculateRelativeSize(16, fontSize)}px;
				user-select: none;
			`,
			contentMenu: css`
				width: fit-content;
        min-width: unset;
				user-select: none;

				.${prefixCls}-dropdown-menu-item.${prefixCls}-dropdown-menu-item {
					margin: 2px 0;
					--${prefixCls}-control-padding-horizontal: 8px;
          --${prefixCls}-dropdown-padding-block: 7px;
					min-width: 76px;
					box-sizing: content-box;
					border-radius: 10px;
				}
				.${prefixCls}-dropdown-menu-item.${prefixCls}-dropdown-menu-item:hover {
					background-color: ${
						isDarkMode
							? token.magicColorUsages.primaryLight.hover
							: token.magicColorUsages.primaryLight.default
					};
				}
				.${prefixCls}-dropdown-menu-item-divider.${prefixCls}-dropdown-menu-item-divider {
					background-color: ${
						isDarkMode
							? token.magicColorUsages.border
							: token.magicColorUsages.primaryLight.default
					};
				}
				.${prefixCls}-dropdown-menu-item-danger.${prefixCls}-dropdown-menu-item-danger:not(.${prefixCls}-dropdown-menu-item-disabled):hover {
					background-color: ${
						isDarkMode
							? token.magicColorUsages.danger.default
							: token.magicColorScales.red[0]
					} !important;
					color: ${isDarkMode ? "white" : token.magicColorUsages.danger.default} !important;
				}
			`,
			contentInnerWrapper: css`
				width: fit-content;
				// padding: ${self ? "4px" : "0"};
				padding: 10px;
				border-radius: 12px;
				user-select: text;

				max-width: calc(100vw - 480px);

				@media (max-width: 964px) {
					max-width: 280px;
				}
			`,

			defaultTheme: css`
				background: ${token.magicColorUsages.bg[1]};
				color: ${token.magicColorUsages.text[1]};
				${isDarkMode ? "" : `border: 1px solid ${token.colorBorder};`}
			`,
			magicTheme: css`
				color: ${token.magicColorUsages.text[1]};
				background: ${isDarkMode ? token.magicColorUsages.primaryLight.default : "#E6F0FF"};
				// background: linear-gradient(99deg, #4768d4 0%, #6c8eff 0.01%, #ca58ff 100%);
			`,
			status: css`
				margin-top: 10px;
				flex-basis: fit-content;
				user-select: none;

				&.${prefixCls}-btn.${prefixCls}-btn {
					padding: 0;
					border: none;
					height: 20px;
					width: 20px;
					border-radius: 50%;
				}
			`,
			checkbox: css`
				user-select: none;
				.${prefixCls}-checkbox-inner {
					border-radius: 50%;
				}
			`,
		}
	},
)

export default useChatMessageStyles
