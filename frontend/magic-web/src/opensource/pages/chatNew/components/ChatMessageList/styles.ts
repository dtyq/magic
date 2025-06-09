import { createStyles } from "antd-style"
import { calculateRelativeSize } from "@/utils/styles"

export const useStyles = createStyles(({ css, token }, { fontSize }: { fontSize: number }) => {
	return {
		container: css`
			height: 100%;
			width: 100%;
			position: relative;
			user-select: none;
			overflow: hidden;
			display: flex;
			flex-direction: column;
			contain: strict;
			will-change: transform;
			transform: translateZ(0);
		`,
		wrapper: css`
			flex: 1;
			position: relative;
			user-select: none;
			overflow-y: auto;
			overflow-x: hidden;
			display: flex;
			flex-direction: column;
			scrollbar-width: thin;
			scrollbar-color: ${token.colorBorder} transparent;
			scroll-behavior: smooth;
			contain: strict;
			max-height: 100%;
			height: 100%;
			will-change: transform;
			transform: translateZ(0);

			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background-color: ${token.colorBorder};
				border-radius: 3px;
			}

			&::-webkit-scrollbar-track {
				background: transparent;
			}
		`,
		chatList: css`
			display: flex;
			flex-direction: column;
			width: 100%;
			background-color: ${token?.magicColorScales.grey[0]};
			position: relative;
			user-select: none;
			padding: 20px 0;
			padding-bottom: ${calculateRelativeSize(30, fontSize)};
			transition: padding 0.3s;
			will-change: transform;
			transform: translateZ(0);
		`,
		hiddenScroll: css`
			overflow-x: hidden !important;
			-webkit-overflow-scrolling: touch;
			display: flex;
			flex-direction: column;
			height: 100%;
			user-select: none;
		`,
		loadingWrapper: css`
			width: 100%;
			padding: 16px;
			text-align: center;
			color: ${token.magicColorUsages.text[2]};
			font-size: 14px;
		`,
		loadMoreButton: css`
			width: 100%;
			padding: 12px;
			text-align: center;
			color: ${token.magicColorUsages.text[2]};
			font-size: 14px;
			cursor: pointer;
			background-color: ${token.magicColorScales.grey[1]};
			border-radius: 4px;
			margin: 8px 0;
			transition: all 0.3s;

			&:hover {
				background-color: ${token.magicColorScales.grey[2]};
				color: ${token.magicColorUsages.text[1]};
			}
		`,
		loadingMore: css`
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 40px;
			display: flex;
			align-items: center;
			justify-content: center;
			background: ${token.colorBgElevated};
			color: ${token.colorTextSecondary};
			font-size: 14px;
			z-index: 10;
			border-bottom: 1px solid ${token.colorBorderSecondary};
		`,
		dropdownMenu: css`
			min-width: 100px;
			width: fit-content;
		`,
		conversationSwitching: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 200px;
			color: ${token.colorTextSecondary};
			font-size: 14px;
			background-color: ${token.magicColorScales.grey[0]};
		`,
	}
})
