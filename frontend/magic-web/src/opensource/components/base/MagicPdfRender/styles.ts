import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => ({
	container: css`
		display: flex;
		height: 100%;
		flex-direction: column;
		background: ${token.colorBgContainer};
		overflow: hidden;
	`,
	toolbar: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: ${token.colorBgElevated};
		border-bottom: 1px solid ${token.colorBorder};
		gap: 12px;
		flex-shrink: 0;
		min-height: 56px;

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			padding: 10px 14px;
			gap: 10px;
		}

		/* 小屏幕 */
		@media (max-width: 800px) {
			padding: 8px 12px;
			gap: 8px;
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			padding: 6px 8px;
			gap: 6px;
		}
	`,
	toolbarLeft: css`
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			gap: 10px;
		}

		/* 小屏幕 */
		@media (max-width: 800px) {
			gap: 8px;
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			gap: 6px;
		}
	`,
	toolbarRight: css`
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			gap: 6px;
		}

		/* 小屏幕 */
		@media (max-width: 800px) {
			gap: 8px;
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			gap: 4px;
		}

		/* 旋转按钮容器 */
		.rotation-buttons {
			display: flex;
			align-items: center;
			gap: inherit;
		}
	`,
	pageInfo: css`
		display: flex;
		align-items: center;
		gap: 8px;
		color: ${token.colorTextSecondary};
		font-size: 14px;
		white-space: nowrap;
		flex-shrink: 0;

		@media (max-width: 1024px) {
			gap: 6px;
		}

		@media (max-width: 800px) {
			font-size: 13px;
			gap: 4px;
		}

		@media (max-width: 480px) {
			font-size: 12px;
		}
	`,
	viewer: css`
		flex: 1;
		overflow: auto;
		display: block;
		padding: 20px;
		background: #f5f5f5;
		min-height: 0;
		width: 100%;
		box-sizing: border-box;

		/* 自定义滚动条样式 */
		&::-webkit-scrollbar {
			width: 8px;
			height: 8px;
		}

		&::-webkit-scrollbar-track {
			background: #f1f1f1;
			border-radius: 4px;
		}

		&::-webkit-scrollbar-thumb {
			background: #c1c1c1;
			border-radius: 4px;

			&:hover {
				background: #a8a8a8;
			}
		}

		@media (max-width: 768px) {
			padding: 16px 8px;
		}
	`,
	pagesContainer: css`
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: center;
		width: fit-content;
		min-width: 100%;
		min-height: fit-content;
		box-sizing: border-box;
		padding: 0;
		margin: 0 auto; /* 居中显示 */
	`,
	pageContainer: css`
		background: white;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border-radius: 8px;
		overflow: hidden;
		transition: box-shadow 0.3s ease;
		width: fit-content;
		box-sizing: border-box;
		max-width: none; /* 移除宽度限制，允许缩放 */

		&:hover {
			box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
		}

		/* 确保PDF页面正确显示 */
		.react-pdf__Page {
			display: block;
		}

		.react-pdf__Page__canvas {
			display: block;
		}

		.react-pdf__Page__textContent {
			user-select: text;
		}

		.react-pdf__Page__annotations {
			pointer-events: auto;
		}
	`,
	currentPage: css`
		box-shadow: 0 6px 20px rgba(24, 144, 255, 0.3);
		border: 2px solid ${token.colorPrimary};
	`,
	pagePlaceholder: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 400px;
		min-height: 400px;
		background: ${token.colorBgLayout};
		border: 2px dashed ${token.colorBorder};
		border-radius: 8px;
		color: ${token.colorTextSecondary};
		font-size: 16px;
		text-align: center;
		gap: 8px;

		&:hover {
			border-color: ${token.colorPrimary};
			color: ${token.colorText};
		}
	`,
	loading: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		min-height: 400px;
		color: ${token.colorTextSecondary};
		gap: 16px;
		font-size: 16px;

		&::before {
			content: "";
			width: 32px;
			height: 32px;
			border: 3px solid ${token.colorBorder};
			border-top: 3px solid ${token.colorPrimary};
			border-radius: 50%;
			animation: spin 1s linear infinite;
		}

		@keyframes spin {
			0% {
				transform: rotate(0deg);
			}
			100% {
				transform: rotate(360deg);
			}
		}
	`,
	error: css`
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 300px;
		color: ${token.colorError};
		gap: 16px;
		padding: 20px;
		text-align: center;

		&::before {
			content: "⚠️";
			font-size: 48px;
		}
	`,
	pageInput: css`
		width: 64px;
		text-align: center;
		flex-shrink: 0;

		&.${prefixCls}-input-number {
			color: ${token.colorText};
			background-color: ${token.colorBgContainer};
			border-color: ${token.colorBorder};

			&:hover {
				border-color: ${token.colorPrimaryHover};
			}

			&:focus-within {
				border-color: ${token.colorPrimary};
				box-shadow: 0 0 0 2px ${token.colorPrimaryBg};
			}

			.${prefixCls}-input-number-input {
				color: ${token.colorText};
				text-align: center;
			}
		}

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			width: 60px;
		}

		/* 小屏幕 */
		@media (max-width: 800px) {
			width: 52px;
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			width: 44px;
		}
	`,
	scaleInput: css`
		width: 85px;
		text-align: center;
		flex-shrink: 0;

		&.${prefixCls}-input-number {
			color: ${token.colorText};
			background-color: ${token.colorBgContainer};
			border-color: ${token.colorBorder};

			&:hover {
				border-color: ${token.colorPrimaryHover};
			}

			&:focus-within {
				border-color: ${token.colorPrimary};
				box-shadow: 0 0 0 2px ${token.colorPrimaryBg};
			}

			.${prefixCls}-input-number-input {
				color: ${token.colorText};
				text-align: center;
			}
		}

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			width: 80px;
		}

		/* 小屏幕 */
		@media (max-width: 800px) {
			width: 70px;
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			width: 60px;
		}
	`,
	buttonGroup: css`
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
		white-space: nowrap;

		@media (max-width: 1024px) {
			gap: 6px;
		}

		@media (max-width: 800px) {
			gap: 4px;
		}

		@media (max-width: 480px) {
			gap: 2px;
		}
	`,
	button: css`
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px 8px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: ${token.colorText};
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 32px;
		height: 32px;
		flex-shrink: 0;

		&:hover:not(:disabled) {
			background: ${token.colorBgTextHover};
			transform: translateY(-1px);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		}

		&:active:not(:disabled) {
			transform: translateY(0);
			background: ${token.colorBgTextActive};
			box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
		}

		&:disabled {
			background: transparent;
			color: ${token.colorTextDisabled};
			cursor: not-allowed;
			transform: none;
			box-shadow: none;
		}

		svg {
			width: 16px;
			height: 16px;
		}

		/* 中等屏幕 */
		@media (max-width: 1024px) {
			padding: 4px 8px;
			min-width: 32px;
			height: 32px;

			svg {
				width: 14px;
				height: 14px;
			}
		}

		/* 小屏幕 - 更紧凑的尺寸 */
		@media (max-width: 800px) {
			padding: 3px 5px;
			min-width: 26px;
			height: 26px;

			svg {
				width: 13px;
				height: 13px;
			}
		}

		/* 超小屏幕 */
		@media (max-width: 480px) {
			padding: 2px 4px;
			min-width: 22px;
			height: 22px;

			svg {
				width: 10px;
				height: 10px;
			}
		}
	`,
	textButton: css`
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		background: ${token.colorPrimary};
		color: ${token.colorWhite};
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
		min-height: 32px;

		&:hover:not(:disabled) {
			background: ${token.colorPrimaryHover};
			transform: translateY(-1px);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		}

		&:active:not(:disabled) {
			transform: translateY(0);
			background: ${token.colorPrimaryActive};
		}

		&:disabled {
			background: ${token.colorBgContainerDisabled};
			color: ${token.colorTextDisabled};
			cursor: not-allowed;
			transform: none;
			box-shadow: none;
		}
	`,
	dropdownMenu: css`
		&.${prefixCls}-dropdown {
			min-width: 200px;
			max-width: 280px;

			.${prefixCls}-dropdown-menu {
				padding: 8px 0;
				box-shadow: 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12),
					0 9px 28px 8px rgba(0, 0, 0, 0.05);
				max-height: none;
				overflow: visible;
			}

			.${prefixCls}-dropdown-menu-item {
				padding: 0 !important;
				margin: 0 !important;

				&:hover {
					background: transparent !important;
				}
			}
		}
	`,
	dropdownItem: css`
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		cursor: pointer;
		transition: background-color 0.2s ease;
		border: none;
		background: transparent !important;
		width: calc(100% - 8px);
		text-align: left;
		color: ${token.colorText};
		border-radius: 6px;
		margin: 0 4px;
		white-space: nowrap;
		justify-content: flex-start;

		&:hover:not(:disabled) {
			background: ${token.colorBgTextHover} !important;
		}

		&:disabled {
			color: ${token.colorTextDisabled};
			cursor: not-allowed;
			background: transparent !important;
		}

		svg {
			width: 16px;
			height: 16px;
			flex-shrink: 0;
		}

		.label {
			flex-shrink: 0;
		}

		.value {
			color: ${token.colorTextSecondary};
			font-size: 12px;
			margin-left: auto;
			flex-shrink: 0;
		}
	`,
	dropdownInputItem: css`
		padding: 8px 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent !important;
		margin: 0 4px;
		border-radius: 6px;
		white-space: nowrap;
		width: calc(100% - 8px);

		&:hover {
			background: ${token.colorBgTextHover} !important;
		}

		.label {
			min-width: 50px;
			color: ${token.colorText};
			font-size: 14px;
			flex-shrink: 0;
		}

		.${prefixCls}-input-number {
			width: 80px;
			flex-shrink: 0;
		}
	`,
	compactToolbar: css`
		@media (max-width: 1024px) {
			.${prefixCls}-space-item {
				margin-right: 4px !important;
			}

			.${prefixCls}-btn {
				padding: 4px 8px;
				font-size: 12px;
				height: 28px;
				min-width: 28px;

				.anticon {
					font-size: 12px;
				}
			}
		}
	`,
}))
