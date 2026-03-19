import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		border-radius: 12px 0 0 12px;
		border: 1px solid rgba(28, 29, 35, 0.01);
		border-right: none;
		background: ${token.colorBgContainer};
		overflow: hidden;
		position: relative;
		height: 100%;
	`,

	header: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 10px;
		height: 40px;
		border-bottom: 1px solid ${token.magicColorUsages.border};
		background: ${token.colorBgContainer};
	`,

	headerTitle: css`
		font-size: 12px;
		font-weight: 600;
		line-height: 16px;
		color: #1c1d23;
	`,

	addFilesButton: css`
		font-size: 12px;
		font-weight: 600;
		line-height: 16px;
		color: #315cec;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;

		&:hover {
			opacity: 0.8;
		}
	`,

	fileList: css`
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-y: auto;
		height: calc(100% - 40px);
	`,

	fileItem: css`
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 8px;
		background: ${token.colorBgContainer};
		transition: all 0.2s ease;

		&:hover {
			background: rgba(28, 29, 35, 0.04);
		}
	`,

	directoryItem: css`
		cursor: pointer;
		user-select: none;

		&:hover {
			background: rgba(28, 29, 35, 0.06);
		}
	`,

	expandIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		color: rgba(28, 29, 35, 0.6);
		flex-shrink: 0;
	`,

	fileInfo: css`
		flex: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	`,

	fileIcon: css`
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	`,

	thumbnail: css`
		width: 20px;
		height: 20px;
		border-radius: 4px;
		object-fit: cover;
		border: 1px solid rgba(28, 29, 35, 0.01);
		flex-shrink: 0;
	`,

	fileName: css`
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: rgba(28, 29, 35, 0.8);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	fileNameInput: css`
		background: #ffffff;
		border: 1px solid #315cec;
		border-radius: 4px;
		padding: 1px 6px;
		height: 24px;
		width: 219px;
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		color: rgba(28, 29, 35, 0.8);
		outline: none;

		&:focus {
			border-color: #315cec;
			box-shadow: 0 0 0 2px rgba(49, 92, 236, 0.1);
		}
	`,

	actions: css`
		display: flex;
		align-items: center;
		gap: 4px;
	`,

	actionButton: css`
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: none;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s ease;
		padding: 1px;

		&:hover {
			background: rgba(28, 29, 35, 0.04);
		}

		&.edit {
			color: rgba(28, 29, 35, 0.8);
		}

		&.delete {
			color: #ff4d3a;
		}
	`,
}))
