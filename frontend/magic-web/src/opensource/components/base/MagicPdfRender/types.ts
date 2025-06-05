export interface MagicPdfRenderProps {
	/** PDF 文件源，可以是 File 对象或 URL 字符串 */
	file?: File | string | null
	/** 是否显示工具栏 */
	showToolbar?: boolean
	/** 初始缩放比例 */
	initialScale?: number
	/** 最小缩放比例 */
	minScale?: number
	/** 最大缩放比例 */
	maxScale?: number
	/** 缩放步长 */
	scaleStep?: number
	/** 容器高度 */
	height?: string | number
	/** 容器宽度 */
	width?: string | number
	/** 是否启用键盘快捷键 */
	enableKeyboard?: boolean
	/** 加载失败回调 */
	onLoadError?: (error: Error) => void
	/** 加载成功回调 */
	onLoadSuccess?: (pdf: any) => void
}
