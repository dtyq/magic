import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, token, css, isDarkMode }) => {
	return {
		magicTabs: css`
			width: 100%;
            height: 100%;
            background-color: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
            display: flex;
            overflow: hidden;
            flex-direction: column;
            border-radius: 8px 8px 0 0;
            scrollbar-width: none;

            .${prefixCls}-tabs-content, .${prefixCls}-tabs-tabpane {
                height: 100%;
            }
            .${prefixCls}-tabs-nav {
                padding-top: 10px;
                padding-inline: 10px;
                margin-bottom: 0;
               
            }

            .${prefixCls}-tabs-tab {
                padding: 10px 20px;
                font-size: 16px;
                font-weight: 400;
                line-height: 22px;
                color: ${token.magicColorUsages.text[1]};
                --${prefixCls}-tabs-horizontal-item-gutter: 0;
                --${prefixCls}-tabs-item-active-color: ${token.magicColorScales.brand[5]};
                --${prefixCls}-tabs-item-hover-color: ${token.magicColorScales.brand[5]};
                --${prefixCls}-tabs-item-selected-color: ${token.magicColorScales.brand[5]};
            }
            .${prefixCls}-tabs-tab-active {
                font-weight: 600;
            }
            .${prefixCls}-tabs-ink-bar {
                background-color: ${token.magicColorScales.brand[5]};
            }
	`,
	}
})
