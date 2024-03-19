import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, prefixCls, isDarkMode, token }, { inSubSider }: { inSubSider: boolean }) => ({
		nodeViewWrapper: css`
			margin: 0 ${inSubSider ? 0 : 4}px;
		`,

		selectOnlyOneOption: css`
			display: inline-block;
			padding: 1px 6px;
			border-radius: 6px;
			font-size: 14px;
			font-weight: 400;
			line-height: 22px;
			user-select: none;
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorScales.brand[1]};
			color: ${token.colorPrimary};
		`,

		select: css`
		--${prefixCls}-select-selector-bg: ${isDarkMode ? token.magicColorUsages.primaryLight.default : token.magicColorScales.brand[1]} !important;
		${
			inSubSider
				? `--${prefixCls}-color-bg-container-disabled: transparent;`
				: `--${prefixCls}-color-bg-container-disabled: ${isDarkMode ? token.magicColorUsages.primaryLight.default : token.magicColorScales.brand[1]}!important;`
		}
    ${
		inSubSider
			? `color: currentColor;`
			: `color: ${isDarkMode ? token.colorPrimary : token.colorPrimary};`
	}
    --${prefixCls}-color-text: ${isDarkMode ? token.colorPrimary : token.colorPrimary};
    ${
		inSubSider
			? `--${prefixCls}-color-text-disabled: currentColor;`
			: `--${prefixCls}-color-text-disabled: ${isDarkMode ? token.colorPrimary : token.colorPrimary};`
	}
    --${prefixCls}-select-hover-border-color: transparent!important;
    --${prefixCls}-select-active-border-color: transparent!important;
    --${prefixCls}-color-text-placeholder: ${isDarkMode ? token.colorPrimary : token.colorPrimary};
    --${prefixCls}-line-width: 0 !important;
    --${prefixCls}-control-outline-width: 0 !important;
    --${prefixCls}-control-height: ${inSubSider ? 16 : 24}px !important;
    --${prefixCls}-padding-sm: 8px!important;
    --${prefixCls}-select-show-arrow-padding-inline-end: 14px!important;
    --${prefixCls}-font-size: ${inSubSider ? 12 : 14}px !important;

    .${prefixCls}-select-selector {
      ${inSubSider ? `padding: 0 !important;` : "padding-right: 6px !important;"}
    }


    &.${prefixCls}-select-disabled {

      .${prefixCls}-select-selector {
        cursor: default !important;
      }

      .${prefixCls}-select-arrow {
        display: none;
      }

      .${prefixCls}-select-selection-item {
        padding-right: 2px;
      }
    }

    font-weight: 400;
    line-height: 20px;
`,
		icon: css`
			color: ${token.colorPrimary};
			padding-left: 2px;
		`,
		notFound: css`
			display: inline-block;
			padding: 2px 6px;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorScales.brand[1]};
			color: ${token.colorTextPlaceholder};
			user-select: none;
		`,
		templateMode: css`
			display: inline-block;
			padding: 0px 6px;
			margin: 0 4px;
			border-radius: 4px;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			background-color: ${token.colorWhite};
			color: ${token.colorPrimary};
			user-select: none;
			border: 1px solid ${token.colorBorder};
		`,
		popup: css`
			width: fit-content;
		`,
		switchWrapper: css`
			&:first-child {
				margin-left: 0;
			}

			${inSubSider
				? ""
				: `background-color: ${
						isDarkMode
							? token.magicColorUsages.primaryLight.default
							: token.magicColorScales.brand[1]
					};`}
			color: ${inSubSider ? "currentColor" : token.colorPrimary};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
			padding: 2px 6px;
			margin: 0 6px;
			border-radius: 6px;
			user-select: none;
			display: inline-block;

			${inSubSider
				? `
        background-color: transparent;
        padding: 0;
        font-size: 12px;
        font-weight: 400;
        line-height: 16px;
        margin: 0;
        color: currentColor;
      `
				: ""}
		`,

		chatSubSiderWrapper: css`
			background-color: transparent;
			padding: 0;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			margin: 0;
			color: currentColor;
		`,
	}),
)
