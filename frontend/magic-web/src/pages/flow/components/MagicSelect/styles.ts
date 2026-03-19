import { createStyles } from "antd-style"

export const useMagicSelectStyles = createStyles(({ token, css }) => ({
	selectWrapper: css`
		&.ant-select {
			.ant-select-selector {
				border-color: ${token.colorBorder};
				background-color: ${token.colorBgContainer};

				&:hover {
					border-color: ${token.colorPrimaryHover};
				}

				&.ant-select-selector-focused {
					border-color: ${token.colorPrimary};
					box-shadow: 0 0 0 2px ${token.colorPrimary}14;
				}
			}

			.ant-select-arrow {
				color: ${token.colorTextSecondary};
				transition: transform 0.2s ease;

				&:hover {
					color: ${token.colorTextHeading};
				}
			}

			&.ant-select-open {
				.ant-select-arrow {
					transform: rotate(180deg);
				}
			}
		}

		// 禁用拖拽相关样式
		&.nodrag {
			user-select: none;
			-webkit-user-select: none;
			-moz-user-select: none;
			-ms-user-select: none;
		}
	`,

	clearIcon: css`
		color: ${token.colorTextSecondary};
		font-size: 16px;
		transition: color 0.2s ease;

		&:hover {
			color: ${token.colorTextHeading};
		}
	`,

	// 全局样式覆盖
	globalSelectStyle: css`
		.ant-select-dropdown {
			border-radius: ${token.borderRadius}px;
			box-shadow: ${token.boxShadowSecondary};

			.ant-select-item {
				padding: 8px 12px;

				&.ant-select-item-option-selected {
					background-color: ${token.colorPrimaryBg};
					color: ${token.colorPrimary};
				}

				&:hover {
					background-color: ${token.colorBgTextHover};
				}
			}
		}

		// 防止滚轮事件冒泡
		.nowheel {
			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background-color: ${token.colorBorderSecondary};
				border-radius: 3px;

				&:hover {
					background-color: ${token.colorBorder};
				}
			}

			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		}
	`,
}))
