import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, token, prefixCls },
		{
			siderCollapsed = false,
			isZh,
			isMobile,
			safeAreaInsetBottom = 0,
		}: {
			siderCollapsed?: boolean
			isZh: boolean
			isMobile?: boolean
			safeAreaInsetBottom?: number | string
		},
	) => {
		return {
			basicContent: css`
				overflow: hidden;
				flex: unset;
				height: 100%;
			`,
			container: css`
				width: 100%;
				height: 100%;
				padding: 30px 10px;
				background-color: ${token.magicColorUsages.bg[0]};
				border-radius: 8px;
			`,
			segmented: css`
				width: fit-content;
				align-self: center;
				.${prefixCls}-segmented-item {
					width: 148px;
					font-size: 14px;
					color: ${token.magicColorUsages.text[0]};
					font-weight: 500;
					border-radius: 8px;
				}
				.${prefixCls}-segmented-item-selected {
					box-shadow:
						0px 1px 3px 0 rgba(0, 0, 0, 0.1),
						0px 1px 2px -1px rgba(0, 0, 0, 0.1);
				}
			`,
			content: css`
				max-width: 900px;
				width: 100%;
				height: 100%;
				margin: 0 auto;
				position: relative;
				overflow: hidden;
			`,
			tabContent: css`
				opacity: 0;
				transform: scale(0.98);
				pointer-events: none;
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				visibility: hidden;
				transition:
					opacity 0.2s ease-out,
					transform 0.2s ease-out,
					visibility 0.2s ease;
				display: flex;
				flex-direction: column;
				gap: 10px;
				overflow-y: auto;
				&[data-active="true"] {
					opacity: 1;
					transform: scale(1);
					pointer-events: auto;
					position: relative;
					visibility: visible;
					scrollbar-width: none;
				}
			`,
			footerContainer: css`
				width: ${isMobile ? "100%" : `calc(100% - ${siderCollapsed ? "56px" : "200px"})`};
				padding: ${isMobile ? "0 10px" : "0"};
				bottom: ${isMobile ? `calc(56px + ${safeAreaInsetBottom})` : "0"};
			`,
			packageInfo: css`
				border-radius: 8px;
				padding: 20px;
				background-color: ${token.magicColorUsages.bg[0]};
				border: 1px solid ${token.magicColorUsages.border};
			`,
			formItem: css`
				margin-bottom: 0;
				width: 100%;
				.${prefixCls}-form-item-label {
					width: ${isZh ? "20%" : "36%"};
					text-align: left;
					label {
						color: ${token.magicColorUsages.text[1]};
					}
				}
			`,
			text: css`
				font-size: 14px;
				color: ${token.magicColorUsages.text[0]};
				font-weight: 600;
			`,
			desc: css`
				font-size: 14px;
				color: ${token.magicColorUsages.text[3]};
				margin-top: 6px;
			`,
			input: css`
				width: 100%;
				.${prefixCls}-input-number-group-addon {
					background-color: white;
				}
			`,
			checkbox: css`
				width: 100%;
				border-radius: 8px;
				padding: 10px 20px;
				background-color: ${token.magicColorUsages.fill[0]};
			`,
			subText: css`
				font-size: 12px;
				color: ${token.magicColorUsages.text[1]};
				font-weight: 600;
				line-height: 16px;
			`,
			subDesc: css`
				font-size: 10px;
				line-height: 13px;
				color: ${token.magicColorUsages.text[3]};
			`,
		}
	},
)
