import { createStyles } from "antd-style"

/** 复用平台信息的行布局，补充折叠区域内的说明和价格对照样式。 */
export const useModelMultiplierStyles = createStyles(({ css, token }) => ({
	root: css`
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		color: ${token.colorText};
	`,
	formField: css`
		margin-bottom: 0;
	`,
	fieldContent: css`
		flex: 1;
		min-width: 0;
	`,
	fieldHint: css`
		margin: 6px 0 0;
		color: ${token.colorTextSecondary};
		font-size: 12px;
		line-height: 1.6;
	`,
	muted: css`
		margin: 0;
		color: ${token.colorTextSecondary};
		font-size: 13px;
		line-height: 1.65;
	`,
	amount: css`
		font-size: 14px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	`,
	section: css`
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid ${token.colorBorderSecondary};
		h4 {
			margin: 0 0 8px;
			font-size: 14px;
			font-weight: 500;
		}
	`,
	example: css`
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr);
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid ${token.colorBorderSecondary};
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
		@media (max-width: 768px) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	`,
	rules: css`
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 20px 28px;
		margin-top: 16px;
		dt {
			font-weight: 500;
			margin-bottom: 4px;
		}
		dd {
			margin: 0;
		}
		@media (max-width: 768px) {
			grid-template-columns: minmax(0, 1fr);
		}
	`,
}))
