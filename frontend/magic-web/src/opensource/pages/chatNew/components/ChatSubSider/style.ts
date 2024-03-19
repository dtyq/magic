import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	const scroll = `
	
			::-webkit-scrollbar {
				width: 6px;
				background-color: transparent;
			}

			::-webkit-scrollbar-thumb {
				background-color: ${token.colorFill};
				border-radius: 6px;
			}

			::-webkit-scrollbar-track {
				background-color: transparent;
			}
				`
	return {
		container: css`
			width: 100%;
			user-select: none;
		`,
		segmentedContainer: css`
			width: 100%;
			padding: 0 12px;
		`,
		segmented: css`
			z-index: 2;
			user-select: none;
			width: 100% !important;
			flex: 1;
		`,
		collapse: css`
			flex: 1;
			min-height: 0;
			height: 100%;
			width: 100%;
			padding: 0;
			overflow-y: hidden;
			overflow-x: visible;
			position: relative;
			user-select: none;
			display: flex;
			flex-direction: column;
		`,
		list: css`
			overflow-y: auto;
			margin-top: 10px;
			user-select: none;
			width: 100%;
			height: 100%;
			min-height: 0;
			display: flex;
			flex-direction: column;
			${scroll}
		`,
		listWrapper: css`
			width: 100%;
			height: 100%;
			box-sizing: border-box;
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;
		`,
		collapseLabel: {
			color: isDarkMode ? token.magicColorUsages.text[2] : token.magicColorUsages.text[2],
			fontSize: 14,
			fontWeight: 400,
			lineHeight: "20px",
			userSelect: "none",
		},
		virtualList: css`
			width: 100%;
			height: 100%;
			min-height: 0;
			display: flex;
			flex-direction: column;
			flex: 1;
		`,
		virtualItem: css`
			padding-bottom: 4px;
		`,
		moreButton: css`
			--${prefixCls}-button-text-hover-bg: ${token.magicColorUsages.fill[0]} !important;
			user-select: none;
		`,
		emptyFallback: css`
			width: 100%;
			height: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
		`,
		emptyFallbackText: css`
			color: ${token.magicColorUsages.text[3]};
			text-align: center;
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
		`,
		panel: css`
			border-bottom: 1px solid ${token.colorSplit};
			display: flex;
			flex-direction: column;
			position: relative;
		`,
		panelHeader: css`
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			background-color: ${isDarkMode ? token.magicColorUsages.bg[0] : token.colorWhite};
			border: none;
			padding: 10px 12px;
			cursor: pointer;
			z-index: 1;
			user-select: none;
			text-align: left;
		`,
		panelLabel: css`
			flex: 1;
		`,
		panelCaret: css`
			color: ${token.colorTextQuaternary};
		`,
		panelBody: css`
			padding: 0 0 4px;
			overflow-y: auto;
			${scroll}
		`,
	}
})

export default useStyles
