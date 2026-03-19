import { css } from "antd-style"

interface TokenType {
	magicColorScales: {
		grey: string[]
	}
	colorBorder: string
	colorBgContainer: string
}

/**
 * 创建预览模式外层容器基础样式
 * @description 用于 desktop 和 phone 模式的外层容器基础样式
 */
export function createPreviewContainerBaseStyle() {
	return css`
		/* 减去头部导航栏高度，编辑场景下可能溢出导致头部导航栏遮挡内容 */
		height: 100%;
		overflow: auto;
		transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	`
}

/**
 * 创建预览模式内层容器基础样式
 * @description 用于 desktop 和 phone 模式的内层容器基础样式
 */
export function createPreviewInnerBaseStyle() {
	return css`
		width: 100%;
		height: 100%;
		flex: none;
		margin: 0 auto;
		transition:
			width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
			border-radius 0.4s cubic-bezier(0.4, 0, 0.2, 1),
			background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	`
}

/**
 * 创建移动端预览模式外层容器样式
 * @description 用于PC端模拟移动端预览效果的外层容器，填满整个区域并应用背景色
 */
export function createPhoneModeContainerStyle(token: TokenType) {
	return css`
		width: 100%;
		height: 100%;
		background-color: ${token.magicColorScales.grey[0]};
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
	`
}

/**
 * 创建移动端预览模式内层容器样式
 * @description 414px宽度的内容区域，白色背景
 */
export function createPhoneModeInnerStyle(token: TokenType) {
	return css`
		width: 416px !important;
		height: calc(100% - 40px);
		margin-top: 20px;
		margin-bottom: 20px;
		border-radius: 8px;
		overflow: hidden;
		background-color: ${token.colorBgContainer};
		border: 1px solid ${token.colorBorder};
		box-shadow:
			0 4px 14px 0 rgba(0, 0, 0, 0.1),
			0 0 1px 0 rgba(0, 0, 0, 0.3);
		flex: none !important;

		.simple-editor-content .tiptap.ProseMirror.simple-editor {
			padding: 1.5rem 1.5rem 30vh;
		}
	`
}

/**
 * 移动端模式容器的配置常量
 */
export const PHONE_MODE_CONFIG = {
	width: 414,
	verticalMargin: 20,
	borderRadius: 8,
} as const
