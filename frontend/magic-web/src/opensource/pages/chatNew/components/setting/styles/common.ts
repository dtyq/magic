import { createStyles } from "antd-style"

const useCommonStyles = createStyles(
	({ css, prefixCls, token }, { isMobile }: { isMobile: boolean }) => ({
		buttonList: css`
			border-radius: 8px;
			width: 100%;
			background: ${isMobile ? token.magicColorUsages.bg[0] : token.magicColorScales.grey[0]};

			.${prefixCls}-btn {
				min-height: 50px;
				border-radius: 0;
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
			}

			.${prefixCls}-btn:not(:last-child) {
				border-bottom: 1px solid ${token.magicColorUsages.border};
			}
		`,
	}),
)

export default useCommonStyles
