import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	searchContainer: {
		overflow: "hidden",
		height: "100%",
		display: "flex",
		flexDirection: "column",
		backgroundColor: token.colorBgContainer,
	},

	searchHeader: {
		display: "flex",
		alignItems: "center",
		// padding: "px 10px",
		padding: 10,
		// borderBottom: `1px solid ${token.colorBorder}`,
		position: "relative",
		justifyContent: "center",
		flex: "none",
		backgroundColor: token.colorFillQuaternary,
	},

	searchInput: {
		height: 32,
		borderRadius: 1000,
		// border: "none !important",
		border: `1px solid ${token.colorBorder} !important`,
		outline: "none !important",
		boxShadow: "none !important",
		padding: "6px 20px 6px 10px",
		// backgroundColor: `${token.colorFillTertiary} !important`,
		backgroundColor: token.magicColorUsages.bg[1],
	},

	suffixContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 1;
		min-width: 0;
		margin-left: 8px;
	`,

	suffix: css`
		padding: 2px 10px;
		height: 20px;
		white-space: nowrap;
		font-size: 12px;
		line-height: 16px;
		flex-shrink: 1;
		border-radius: 1000px;
		overflow: hidden;
		text-overflow: ellipsis;
	`,
	suffixSelected: css`
		background: #eef3fd;
		color: ${token.colorPrimary};
	`,
	suffixDefault: css`
		background: rgba(46, 47, 56, 0.05);
		color: ${token.colorText};
	`,
}))
