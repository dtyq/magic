import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls, responsive }) => ({
	container: css``,

	draftBox: css`
		display: flex;
		padding: 4px;
		align-items: center;
		gap: 8px;
		border-radius: 4px;
		border: 1px solid ${token.colorBorder};

		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;

		font-family: ${token.fontFamily};
		font-size: 10px;
		font-style: normal;
		font-weight: 400;
		line-height: 13px;

		&:hover {
			background-color: ${token.colorBgTextHover};
		}

		cursor: pointer;

		${responsive.mobile} {
			&& {
				border-radius: 8px;
				padding: 5px;
				background: transparent;
				color: unset;
				border-color: ${token.magicColorUsages.border};
			}
		}
	`,

	mobileIcon: css`
		width: 20px;
		height: 20px;
		cursor: pointer;
		border-radius: 8px;
	`,

	modal: css`
		--${prefixCls}-modal-body-padding: 0;
		overflow: hidden;
		border-radius: 12px;
	`,

	header: css`
		padding: 20px;
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	`,

	headerLeft: css`
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
	`,

	icon: css`
		width: 30px;
		height: 30px;
		background: linear-gradient(135deg, #ff7d00 0%, #ffa200 100%);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	`,

	titleSection: css`
		display: flex;
		flex-direction: column;
		flex: 1;
	`,

	title: css`
		font-size: 18px;
		font-weight: 600;
		line-height: 24px;
		color: rgba(28, 29, 35, 0.8);
		margin: 0;
	`,

	subtitle: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: rgba(28, 29, 35, 0.6);
		margin: 0;
	`,

	closeButton: css`
		width: 32px;
		height: 32px;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		border-radius: 4px;
		color: rgba(28, 29, 35, 0.8);

		&:hover {
			background: ${token.magicColorUsages.fill[0]};
		}
	`,

	content: css`
		flex: 1;
		padding: 0 20px 20px 20px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 20px;
		max-height: 80vh;

		${responsive.mobile} {
			padding: 0;
		}
	`,

	scrollContainer: css`
		flex: 1;
		background: #f9f9f9;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
		border: 1px solid ${token.magicColorUsages.border};

		${responsive.mobile} {
			border-radius: 0;
		}
	`,

	draftBoxTip: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		text-align: center;

		${responsive.mobile} {
			margin-bottom: 10px;
		}
	`,

	scrollContent: css`
		padding: 10px 10px 10px 10px;
		max-height: 60vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 10px;

		/* Custom scrollbar */
		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background: rgba(46, 47, 56, 0.13);
			border-radius: 100px;
		}

		&::-webkit-scrollbar-thumb {
			background: rgba(46, 47, 56, 0.3);
			border-radius: 100px;
		}
	`,

	draftItem: css`
		background: #ffffff;
		border-radius: 8px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,

	draftContent: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: #1c1d23;
		word-break: break-word;
		display: flex;
		flex-direction: column;
		gap: 4px;
	`,

	draftFooter: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,

	timeInfo: css`
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		border-radius: 8px;
	`,

	timeText: css`
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
		color: rgba(28, 29, 35, 0.8);
	`,

	actions: css`
		display: flex;
		align-items: center;
		gap: 10px;
	`,

	actionButton: css`
		padding: 4px 12px;
		border-radius: 8px;
		border: 1px solid;
		background: #ffffff;
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-1px);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		}
	`,

	deleteButton: css`
		border-color: #ff4d3a;
		color: #ff4d3a;
	`,

	useButton: css`
		border-color: #315cec;
		color: #315cec;
	`,

	emptyState: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: rgba(28, 29, 35, 0.6);
		font-size: 14px;
	`,
}))
