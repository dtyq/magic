import type { Theme } from "antd-style"
import { css } from "antd-style"

export default ({ prefixCls, token }: { prefixCls: string; token: Theme }) => css`
	.${prefixCls}-menu-item {
		display: flex !important;
		align-items: center;
		padding-left: 8px !important;
		padding-right: 8px !important;
	}

	.${prefixCls}-menu-title-content {
		margin-inline-start: 4px !important;
	}

	.${prefixCls}-message-custom-content {
		display: flex !important;
		align-items: center;
		justify-content: center;
		gap: 10px;
	}
  
	th.${prefixCls}-table-cell {
		--${prefixCls}-table-cell-padding-block: 10px !important;
	}

  .${prefixCls}-menu-title-content {
    flex: 1;
  }

  .${prefixCls}-dropdown-menu-submenu-title{
    display: flex;
    align-items: center;
  }

  /* 拖拽文件时隐藏所有 tooltips，避免干扰拖拽体验 */
  body.dragging-files .${prefixCls}-tooltip {
    display: none !important;
  }
  
  body.dragging-files .${prefixCls}-tooltip-inner {
    display: none !important;
  }
  
  body.dragging-files .${prefixCls}-tooltip-arrow {
    display: none !important;
  }

  .${prefixCls}-notification-notice-wrapper.${prefixCls}-notification-notice-wrapper {
	  border-radius: 12px;
    background-color: #fff;
    box-shadow: 0 0 1px 0 rgba(0, 0, 0, 0.30), 0 4px 14px 0 rgba(0, 0, 0, 0.10);
  }

  .${prefixCls}-input-outlined:focus,
  .${prefixCls}-input-outlined:focus-within {
    box-shadow: none !important;
  }
`
