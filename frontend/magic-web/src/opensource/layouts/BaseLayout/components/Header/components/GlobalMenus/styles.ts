import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	popupContainer: css`
		width: 348px;
		background: ${token.colorBgElevated};
		border-radius: 12px;
		box-shadow:
			0 6px 16px 0 rgba(0, 0, 0, 0.08),
			0 3px 6px -4px rgba(0, 0, 0, 0.12),
			0 9px 28px 8px rgba(0, 0, 0, 0.05);
	`,

	menuGrid: css`
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		margin: 0;
		border-bottom: 1px solid ${token.colorBorder};
		padding: 18px;

		&:last-child {
			border-bottom: none;
		}
	`,

	menuItem: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 8px;
		cursor: pointer;
		border-radius: 8px;
		transition: all 0.2s ease;
		text-decoration: none;
		color: inherit;

		&:hover {
			background: ${token.colorFillTertiary};
		}

		&:active {
			transform: scale(0.95);
		}
	`,

	menuIcon: css`
		margin-bottom: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;

		&::after {
			content: "";
			position: absolute;
			top: 0;
			left: 0;
			width: 24px;
			height: 24px;
			background-color: var(--mask-color);
			transform: translate(8px, 8px);
			border-radius: 50%;
			z-index: -1;
		}
	`,

	menuLabel: css`
		color: ${token.magicColorUsages.text[1]};
		text-align: center;
		font-size: 14px;
		font-style: normal;
		font-weight: 400;
		line-height: 20px;
	`,

	badge: css`
		position: relative;

		&::after {
			content: "";
			position: absolute;
			top: -2px;
			right: -2px;
			width: 8px;
			height: 8px;
			background: ${token.colorError};
			border-radius: 50%;
			border: 2px solid ${token.colorBgElevated};
		}
	`,

	badgeNumber: css`
		position: relative;

		&::after {
			content: "99+";
			position: absolute;
			top: -8px;
			right: -8px;
			background: ${token.colorError};
			color: white;
			font-size: 10px;
			line-height: 1;
			padding: 2px 4px;
			border-radius: 6px;
			min-width: 16px;
			text-align: center;
			font-weight: 500;
		}
	`,
}))
