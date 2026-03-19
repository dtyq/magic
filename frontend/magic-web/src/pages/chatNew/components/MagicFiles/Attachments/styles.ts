import { createStyles } from "antd-style"

export const FILE_ITEM_HEIGHT = 46

export const FILE_ITEM_GAP = 8

export const useStyles = createStyles(
	({ css, token, prefixCls }, { isMobile }: { isMobile: boolean }) => {
		return {
			container: css`
				padding: 8px;
				border-radius: 10px;
				border: 1px solid ${token.colorBorder};
				background: ${token.colorBgContainer};
				width: 100%;
				min-width: ${isMobile ? "50vw" : "288px"};
				max-width: 100%; /* 防止容器超出父元素 */
				overflow: hidden;
				user-select: none;
			`,
			fileList: css`
				overflow: hidden;
				transition: height 0.3s ease-in-out;
			`,
			fileItem: css`
				border: 1px solid ${token.colorBorder};
				border-radius: 4px;
				padding: 8px;
				height: ${FILE_ITEM_HEIGHT}px;
				min-width: 0; /* 允许flex子项收缩 */

				color: ${token.colorText};
				font-size: ${token.fontSize};
				font-style: normal;
				font-weight: 400;
				line-height: 16px;
			`,
			more: css`
				font-size: ${token.fontSize}px;
				font-style: normal;
				font-weight: 400;
				line-height: 16px;
				text-align: center;
				padding-top: 8px;
				cursor: pointer;
				width: 100%;
				background-color: ${token.colorBgContainer};
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;

				&:hover {
					color: ${token.colorPrimary};
				}
			`,
			fileName: css`
				flex: 1; /* 使用flex而不是固定宽度 */
				min-width: 0; /* 允许收缩 */
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;

				color: ${token.colorText};
				font-size: 12px;
				font-weight: 400;
				line-height: 16px;
			`,
			controlButton: css`
				width: 30px;
				height: 30px;
				flex-shrink: 0; /* 防止按钮被压缩 */
				--${prefixCls}-button-padding-inline-sm: 6px !important;
				--${prefixCls}-button-padding-block-sm: 6px !important;
				background-color: ${token.magicColorUsages.fill[0]};

				&:hover,
				&:active,
				&:focus {
					background-color: ${token.magicColorUsages.fill[1]} !important;
				}
			`,
			fileSize: css`
				color: ${token.colorTextSecondary};
				font-size: 10px;
				font-weight: 400;
				line-height: 12px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			`,
		}
	},
)
