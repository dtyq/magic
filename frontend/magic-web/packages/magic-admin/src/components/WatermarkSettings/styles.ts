import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	watermarkDescription: css`
		margin: -4px 0 12px;
		color: ${token.magicColorUsages.text[2]};
		font-size: 14px;
	`,
	watermarkGrid: css`
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(260px, 2fr);
		gap: 24px;
		align-items: stretch;

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
		}
	`,
	watermarkPanel: css`
		overflow: hidden;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 10px;
		background: ${token.magicColorUsages.bg[0]};
	`,
	watermarkRow: css`
		display: flex;
		gap: 18px;
		align-items: center;
		justify-content: space-between;
		padding: 24px;
		border-bottom: 1px solid ${token.magicColorUsages.border};

		& > div:first-child {
			min-width: 0;
			flex: 1 1 auto;
		}

		@media (max-width: 768px) {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}
	`,
	watermarkSwitchRow: css`
		display: flex;
		align-items: center;
		justify-content: space-between;

		@media (max-width: 768px) {
			flex-direction: row;
			align-items: center;
		}
	`,
	watermarkTitle: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 16px;
		font-weight: 600;
		line-height: 24px;
	`,
	watermarkHint: css`
		margin-top: 6px;
		color: ${token.magicColorUsages.text[3]};
		font-size: 13px;
		line-height: 20px;
	`,
	watermarkControl: css`
		display: flex;
		margin-inline-start: auto;
		justify-content: flex-end;

		@media (max-width: 768px) {
			width: 100%;
			margin-inline-start: 0;
		}
	`,
	watermarkFields: css`
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 20px;
		width: 100%;
		justify-items: start;

		@media (max-width: 768px) {
			width: 100%;
			justify-items: start;
		}
	`,
	disabled: css`
		opacity: 0.55;
	`,
	intensityGroup: css`
		display: flex !important;
		flex-direction: row !important;
		flex-wrap: nowrap;
		align-items: center;
		gap: 8px;
		width: 100%;
		justify-content: flex-end;

		/* Keep independent equal-width buttons with a compact adaptive gap. */
		& > .ant-radio-button-wrapper {
			box-sizing: border-box;
			flex: 1 1 0;
			min-width: 0;
			height: 48px;
			padding-inline: 8px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: 1px solid ${token.magicColorUsages.border};
			border-inline-start-width: 1px;
			border-radius: 8px;
			color: ${token.magicColorUsages.text[2]};
			font-size: 16px;
			line-height: 24px;
			text-align: center;
			transition: none;
		}

		& > .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) {
			background: ${token.magicColorUsages.black};
			border-color: ${token.magicColorUsages.black};
			box-shadow: none;
			color: ${token.magicColorUsages.white};
		}

		& > .ant-radio-button-wrapper:hover {
			color: ${token.magicColorUsages.text[1]};
		}

		& > .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled):hover {
			background: ${token.magicColorUsages.black};
			border-color: ${token.magicColorUsages.black};
			color: ${token.magicColorUsages.white};
		}

		& > .ant-radio-button-wrapper:not(:first-child)::before {
			display: none;
		}

		@media (max-width: 768px) {
			width: 100%;
		}
	`,
	watermarkNotice: css`
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 16px 24px;
		color: ${token.magicColorUsages.text[3]};
		font-size: 13px;
		line-height: 20px;
	`,
	previewPanel: css`
		min-width: 0;
		display: flex;
		flex-direction: column;
		height: 100%;
	`,
	previewBox: css`
		position: relative;
		flex: 1 1 auto;
		margin-top: 14px;
		overflow: hidden;
		border: 1px solid ${token.magicColorUsages.border};
		border-radius: 12px;
		background: ${token.magicColorUsages.bg[0]};
	`,
	previewLayer: css`
		position: absolute;
		inset: -100px;
		display: grid;
		/* Keep each repeated watermark label wide enough for its current content.
		 * Using a zero-width grid minimum lets long labels overflow into the
		 * neighboring track, which is what caused overlap after selecting more
		 * watermark fields. */
		grid-template-columns: repeat(2, minmax(max-content, 1fr));
		align-content: space-around;
		gap: 34px 16px;
		transform: rotate(-12deg);
		font-family: -apple-system, "Segoe UI", sans-serif;
		font-size: 18px;
		line-height: 21.6px;
		white-space: nowrap;

		& > span {
			min-width: max-content;
			width: fit-content;
		}
	`,
}))
