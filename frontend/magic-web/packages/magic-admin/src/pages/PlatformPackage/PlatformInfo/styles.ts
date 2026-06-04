import { createStyles } from "antd-style"

export const useStyles = createStyles(
	({ css, token }, { siderCollapsed = false }: { siderCollapsed?: boolean }) => {
		return {
			container: css`
				min-width: 400px;
				max-width: 920px;
				height: 100%;
				margin: 0 auto;
				display: flex;
				flex-direction: column;
				gap: 10px;
				padding: 30px 10px 10px 10px;
				overflow-y: auto;

				@media (max-width: 768px) {
					min-width: 0;
					max-width: 100%;
					padding: 0;
				}
			`,
			formWrapper: css`
				width: 100%;
				padding: 20px;
				display: flex;
				flex-direction: column;
				gap: 10px;
				background-color: ${token.magicColorUsages.bg[0]};
				border-radius: 8px;

				@media (max-width: 768px) {
					gap: 20px;
				}
			`,
			formItem: css`
				display: flex;
				align-items: flex-start;
				justify-content: space-between;
				@media (max-width: 768px) {
					gap: 8px;
					flex-direction: column;
					align-items: flex-start;
				}
			`,
			formItemLabel: css`
				flex: 1;
				font-size: 14px;
				font-style: normal;
				font-weight: 400;
				line-height: 20px;
				color: ${token.magicColorUsages.text[1]};
			`,
			formItemLabelRequired: css`
				padding-left: 4px;
				color: ${token.magicColorUsages.danger.default};
			`,
			formItemContent: css`
				width: 100%;
			`,
			platformLogoImageWrapper: css`
				max-width: 100%;
				min-width: 62px;
				height: 62px;
				display: flex;
				align-items: center;
				justify-content: center;
			`,
			platformLogoImageWrapperBorder: css`
				border: 1px solid ${token.magicColorUsages.border};
				border-radius: 12px;
				overflow: hidden;
			`,
			platformLogoImage: css`
				max-width: 100%;
				max-height: 62px;
				width: auto;
				height: auto;
				object-fit: contain;
			`,
			uploadLogoButton: css`
				padding-left: 12px;
				padding-right: 12px;
			`,
			formItemLabelTip: css`
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
				color: ${token.magicColorUsages.text[3]};
				white-space: pre-wrap;

				@media (max-width: 768px) {
					white-space: normal;
				}
			`,
			footerContainer: css`
				width: calc(100% - ${siderCollapsed ? "56px" : "200px"});

				@media (max-width: 768px) {
					width: 100%;
					padding: 0px 10px;
				}
			`,
		}
	},
)
