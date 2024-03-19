import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	title: css`
		font-family: PingFang SC;
		font-weight: 600;
		font-style: Semibold;
		font-size: 16px;
		leading-trim: NONE;
		color: ${token.colorText};
		border-bottom: 1px solid ${token.colorBorder};
		padding-bottom: 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	`,
	titleRight: css`
		display: flex;
		align-items: center;
		gap: 12px;
	`,
	visibleRangeButton: css`
		height: 28px;
		padding: 0 8px;
		gap: 4px;
		border-radius: 6px;
		border: 1px solid ${token.colorBorder};
		background: ${token.colorBgContainer};
		cursor: pointer;
		font-size: 13px;
		font-weight: 400;
		color: ${token.magicColorUsages.text[1]};
		transition: all 0.2s;

		&:hover {
			border-color: ${token.colorPrimary};
			color: ${token.colorPrimary};
		}

		&:active {
			background: ${token.colorFillQuaternary};
		}
	`,
	visibleRangeContent: css`
		width: 420px;
		max-height: 500px;
		overflow-y: auto;
	`,
	visibleRangePopover: css`
		.ant-popover-inner {
			padding: 16px;
		}
	`,
	modalFooter: css`
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 0 0 0;
		border-top: 1px solid ${token.colorBorder};
		margin-top: 16px;
	`,

	cancelButton: css`
		min-width: 80px;
		height: 36px;
		border-radius: 8px;
		font-weight: 400;
		border: 1px solid ${token.colorBorder};
		color: ${token.magicColorUsages.text[1]};
		background: ${token.colorFillAlter};

		&:hover {
			border-color: ${token.colorPrimary};
			background: ${token.colorBgContainer};
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`,

	confirmButton: css`
		min-width: 80px;
		height: 36px;
		border-radius: 8px;
		font-weight: 400;
		background: ${token.colorPrimary};
		border: 1px solid ${token.colorPrimary};
		font-size: 14px;
		line-height: 20px;
		&:hover {
			background: ${token.colorPrimaryHover};
			border-color: ${token.colorPrimaryHover};
		}

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
	`,
	editText: {
		fontSize: 12,
	},
	AIeditContainer: {
		display: "inline-block",
		height: "24px",
		paddingRight: 16,
	},
	AIeditButtons: {
		height: "100%",
		gap: 4,
		padding: "0 4px",
		position: "relative",
		background: "white",
		borderRadius: 6,
		cursor: "pointer",
		userSelect: "none",
		"&::before": {
			content: '""',
			position: "absolute",
			inset: 0,
			padding: "1px",
			borderRadius: 6,
			background: "linear-gradient(128.37deg, #3F8FFF 5.59%, #EF2FDF 95.08%)",
			mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
			maskComposite: "xor",
			WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
			WebkitMaskComposite: "xor",
		},
	},
	aiEditText: {
		background: "linear-gradient(128.37deg, #3F8FFF 5.59%, #EF2FDF 95.08%)",
		backgroundClip: "text",
		WebkitBackgroundClip: "text",
		WebkitTextFillColor: "transparent",
		fontWeight: 600,
		fontSize: 12,
	},
	dropdownContent: css`
		background: ${token.colorBgContainer};
		padding: 10px;
		border-radius: 8px;
		box-shadow:
			0px 0px 1px 0px rgba(0, 0, 0, 0.3),
			0px 0px 30px 0px rgba(0, 0, 0, 0.06);
		gap: 4px;
		min-width: 268px;
		border: 1px solid ${token.colorBorder};
	`,
	dropdownItem: css`
		display: flex;
		gap: 4px;
		align-items: flex-start;
		padding: 6px 10px;
		border-radius: 4px;
		cursor: pointer;
		&:hover {
			background: ${token.colorFillTertiary};
		}

		&:active {
			background: ${token.colorFillSecondary};
		}

		&:nth-child(2) {
			border-bottom: 1px solid ${token.colorBorder};
		}
	`,
	itemIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	`,
	itemContent: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	`,
	itemTitle: css`
		font-family: PingFang SC;
		font-weight: 400;
		font-style: Regular;
		font-size: 14px;
		leading-trim: NONE;
		line-height: 20px;
		letter-spacing: 0px;
		color: ${token.magicColorUsages.text[1]};
	`,
	itemDesc: css`
		color: ${token.magicColorUsages.text[2]};
		font-family: PingFang SC;
		font-weight: 400;
		font-style: Regular;
		font-size: 12px;
		leading-trim: NONE;
		line-height: 16px;
		letter-spacing: 0px;
	`,
}))
