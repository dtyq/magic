import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => ({
	container: css`
		position: relative;
		width: 100%;
		max-width: 500px;
		border-radius: 8px;
		overflow: hidden;
		background-color: ${isDarkMode ? token.colorBgContainer : "#000"};
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: box-shadow 0.3s ease;
		margin: 0.5em 0;

		&:hover {
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		}
	`,

	video: css`
		width: 100%;
		height: auto;
		max-height: 400px;
		display: block;
		background-color: #000;
		object-fit: contain;

		&:focus {
			outline: none;
		}
	`,

	skeleton: css`
		width: 100%;
		min-height: 180px;
		border-radius: 8px;
		overflow: hidden;
	`,

	skeletonContent: css`
		width: 100%;
		min-height: 180px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background-color: ${isDarkMode ? token.colorBgContainer : "#f5f5f5"};
		color: ${token.colorTextSecondary};
		font-size: 14px;
		padding: 20px;
	`,

	errorContainer: css`
		background-color: ${isDarkMode ? token.colorBgContainer : "#f5f5f5"};
		border: 1px dashed ${token.colorBorder};
		cursor: pointer;
		transition: all 0.3s ease;

		&:hover {
			border-color: ${token.colorPrimary};
			background-color: ${isDarkMode ? token.colorBgElevated : "#fafafa"};
		}
	`,

	errorContent: css`
		width: 100%;
		min-height: 180px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: ${token.colorTextSecondary};
		font-size: 14px;
		padding: 20px;
	`,

	retryButton: css`
		padding: 8px 16px;
		background-color: ${token.colorPrimary};
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.3s ease;

		&:hover {
			background-color: ${token.colorPrimaryHover};
		}

		&:focus {
			outline: none;
			box-shadow: 0 0 0 2px ${token.colorPrimaryBorder};
		}
	`,

	controls: css`
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
		color: white;
		padding: 16px 12px 12px;
		opacity: 0;
		transform: translateY(100%);
		transition: all 0.3s ease;
		pointer-events: none;
	`,

	controlsVisible: css`
		opacity: 1;
		transform: translateY(0);
		pointer-events: all;
	`,

	progressContainer: css`
		margin-bottom: 12px;
	`,

	progressBar: css`
		width: 100%;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;

		&::-webkit-slider-thumb {
			-webkit-appearance: none;
			appearance: none;
			width: 16px;
			height: 16px;
			background: ${token.colorPrimary};
			border-radius: 50%;
			cursor: pointer;
			border: 2px solid white;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}

		&::-moz-range-thumb {
			width: 16px;
			height: 16px;
			background: ${token.colorPrimary};
			border-radius: 50%;
			cursor: pointer;
			border: 2px solid white;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}
	`,

	controlButtons: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	`,

	leftControls: css`
		display: flex;
		align-items: center;
		gap: 12px;
	`,

	rightControls: css`
		display: flex;
		align-items: center;
		gap: 8px;
	`,

	controlButton: css`
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		padding: 8px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;

		&:hover {
			background-color: rgba(255, 255, 255, 0.2);
		}

		&:focus {
			outline: none;
			background-color: rgba(255, 255, 255, 0.2);
		}
	`,

	volumeContainer: css`
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 80px;
	`,

	volumeSlider: css`
		width: 60px;
		height: 3px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.3);
		border-radius: 2px;
		outline: none;
		cursor: pointer;

		&::-webkit-slider-thumb {
			-webkit-appearance: none;
			appearance: none;
			width: 12px;
			height: 12px;
			background: white;
			border-radius: 50%;
			cursor: pointer;
			border: none;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		}

		&::-moz-range-thumb {
			width: 12px;
			height: 12px;
			background: white;
			border-radius: 50%;
			cursor: pointer;
			border: none;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		}
	`,

	timeDisplay: css`
		font-size: 12px;
		color: rgba(255, 255, 255, 0.9);
		white-space: nowrap;
		font-family: ${token.fontFamilyCode};
		min-width: 80px;
	`,

	placeholder: css`
		background-color: ${isDarkMode ? token.colorBgContainer : "#f5f5f5"};
		border: 1px dashed ${token.colorBorder};
		transition: all 0.3s ease;

		&:hover {
			border-color: ${token.colorPrimary};
			background-color: ${isDarkMode ? token.colorBgElevated : "#fafafa"};
		}
	`,

	placeholderContent: css`
		width: 100%;
		min-height: 180px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		color: ${token.colorTextSecondary};
		font-size: 14px;
		padding: 20px;
	`,
}))
