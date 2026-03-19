import { createStyles } from "antd-style"

const useStyles = createStyles(
	({ css, isDarkMode, prefixCls, token }, { circle }: { circle?: boolean }) => {
		return {
			segmented: css`
				width: fit-content;
				border-radius: ${circle ? "100px" : "2px"};
				padding: 3px;

				.${prefixCls}-segmented-item, .${prefixCls}-segmented-thumb {
					border-radius: ${circle ? "100px" : "2px"};
				}

				.${prefixCls}-segmented-item-selected {
					font-weight: 600;
					color: ${token.magicColorScales.brand[5]};
					box-shadow:
						0px 4px 14px 0px rgba(0, 0, 0, 0.1),
						0px 0px 1px 0px rgba(0, 0, 0, 0.3);
				}

				${isDarkMode
					? `
            background-color:${token.magicColorScales.grey[1]};
            --${prefixCls}-segmented-item-selected-bg: ${token.magicColorUsages.bg[1]};
            --${prefixCls}-segmented-item-color: ${token.magicColorUsages.text[2]} !important;
            --${prefixCls}-segmented-item-hover-color: ${token.magicColorUsages.text[3]} !important;
          `
					: ""}
			`,
		}
	},
)

export default useStyles
