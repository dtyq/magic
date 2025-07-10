import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		splitter: css`
			--${prefixCls}-splitter-split-bar-draggable-size: 0 !important;
			--${prefixCls}-splitter-split-trigger-size: 0 !important;
      

      .${prefixCls}-splitter-panel{
        padding: 0 !important;
        overflow: hidden;
      }

			.${prefixCls}-splitter-bar-dragger::before {
				background-color: transparent !important;

				&:hover {
					background-color: transparent !important;
				}
			}
		`,
	}
})
