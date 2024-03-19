import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token }) => {
	return {
		tabs: {
			width: "100%",
			height: "100%",
			backgroundColor: token.magicColorUsages.bg[1],
			[`--${prefixCls}-tabs-item-selected-color`]: `${token.magicColorUsages.primary.default} !important`,
			[`--${prefixCls}-tabs-item-active-color`]: `${token.magicColorUsages.primary.active} !important`,
			[`--${prefixCls}-tabs-item-hover-color`]: `${token.magicColorUsages.primary.hover} !important`,

			[`.${prefixCls}-tabs-content`]: {
				width: "100%",
				height: "100%",
			},
			[`.${prefixCls}-tabs-tabpane`]: {
				height: "100%",
			},
			[`.${prefixCls}-tabs-nav`]: {
				// backgroundColor: token.magicColorUsages.fill[0],
				height: 44,
				paddingLeft: 20,
				margin: 0,
			},
			[`.${prefixCls}-tabs-tab-btn:focus`]: {
				outline: "none",
				boxShadow: "unset",
				border: "unset",
			},
		},
	}
})
