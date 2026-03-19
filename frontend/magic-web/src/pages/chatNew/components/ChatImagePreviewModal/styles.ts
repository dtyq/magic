import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, prefixCls, token, isDarkMode }) => ({
	wrapper: css`
		pointer-events: none;
	`,
	resizableContainer: css`
		width: 100%;
	`,
	imagePreview: css`
		height: 100%;
		position: relative;
	`,
	svg: css`
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;

		svg,
		p {
			font-size: 14px;
		}
	`,
	content: css`
    --${prefixCls}-modal-content-padding: 0px;
    border-radius: 12px;
    overflow: hidden;
    --${prefixCls}-modal-header-margin-bottom: 0px;
    .magic-modal-header {
      z-index: 1001;
      position: relative;
    }
  `,
	body: css`
    padding: 0px;
    --${prefixCls}-modal-content-bg: ${token.colorBgContainer};
		max-height: 80vh;
		background-color: #f5f5f5;
		background-color: ${token.magicColorUsages.bg[1]};
	`,
	title: css`
		overflow: hidden;
		color: ${token.magicColorUsages.text[1]};
		text-overflow: ellipsis;
		font-size: 14px;
		line-height: 20px;
		font-weight: 400;
	`,
	subtitle: css`
		overflow: hidden;
		color: ${token.colorTextQuaternary};
		text-overflow: ellipsis;
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
	`,
	headerButton: css`
		color: ${token.colorTextSecondary};
		font-size: 10px;
		font-weight: 400;
		line-height: 12px;
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};
		padding: 4px 8px;
		height: 40px;
		width: 70px;
	`,
	mask: css`
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		backdrop-filter: blur(8px);
		background: rgba(255, 255, 255, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		z-index: 1;
	`,
	progress: css`
		width: 512px;
		height: 10px;
		.${prefixCls}-progress-inner {
			background-color: ${isDarkMode
				? token.magicColorScales.grey[0]
				: token.magicColorScales.grey[0]};
		}
	`,
	progressText: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[0]};
	`,
}))

export default useStyles
