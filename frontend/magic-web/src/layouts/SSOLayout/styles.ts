import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		layout: css`
			width: 100vw;
			height: 100%;
			background: ${token.magicColorUsages.bg[0]};
			background-size: cover;
			background-position: center;
			background-repeat: no-repeat;
			position: relative;
			overflow-x: hidden;
			overflow-y: hidden;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
		dragBar: css`
			width: 100%;
			height: ${token.titleBarHeight}px;
			position: absolute;
			left: 0;
			top: 0;
		`,
		wrapper: css`
			width: 100%;
			height: 100%;
			box-sizing: border-box;
			overflow: hidden;
			text-align: center;
		`,
		content: css`
			flex: 1;
			width: 100%;

			@media screen and (max-width: 768px) {
				gap: 20px;
			}
		`,
		main: css`
			padding-bottom: 20px;
			height: 100%;
			flex: 1;
			overflow-y: auto;
			overflow-x: auto;
			justify-content: flex-start;

			@media (max-width: 700px) {
				/* 手机端需要减去安全区域 */
				padding-top: ${token.safeAreaInsetTop};
				padding-bottom: max(20px, ${token.safeAreaInsetBottom});
			}
		`,
		header: css`
			width: 100%;
			padding: 20px;
		`,
		macMenu: css`
			margin-right: auto;
		`,
		container: css`
			width: 600px;
			height: fit-content;
			padding: 40px;

			border-radius: 12px;
			z-index: 1;
			background-color: ${token.magicColorUsages.bg[0]};
			border: 1px solid ${token.magicColorUsages.border};

			margin-top: auto;
			margin-bottom: auto;

			@media (max-width: 700px) {
				width: 100vw;
				min-width: 375px;
				border: none;
				overflow: hidden;
				background-color: transparent;
				padding: 20px 30px;
				margin-top: 10px !important;
			}

			@media (min-height: 1000px) {
				margin-top: 150px;
			}
		`,
	}
})
