import { lazy, Suspense } from "react"
import type { EditorProps } from "@/opensource/lib/monacoEditor"
import { createStyles } from "antd-style"
import MagicLoading from "@/opensource/components/other/MagicLoading"

const Editor = lazy(() => import("@/opensource/lib/monacoEditor/MonacoEditor"))

const useStyles = createStyles(({ css }) => ({
	editor: css`
		width: 100%;
		height: 100%;
		padding: 0 2px 0 10px;
	`,
	loading: css`
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	`,
	icon: css`
		width: 100px;
	`,
}))

export default function MagicEditor(props: EditorProps) {
	const { value, onChange, onMount, onValidate } = props

	const { styles } = useStyles()

	return (
		<div className={styles.editor}>
			<Suspense
				fallback={
					<div className={styles.loading} data-index="0">
						<MagicLoading size={24} className={styles.icon} />
					</div>
				}
			>
				<Editor
					value={value}
					onChange={onChange}
					onMount={onMount}
					onValidate={onValidate}
					options={{
						minimap: { enabled: false }, // 禁用小地图
						lineNumbers: "on", // 关闭行号
						folding: true, // 启用折叠
						lineDecorationsWidth: 0, // 减少左边空白
						lineNumbersMinChars: 0, // 最小化行号区域
						automaticLayout: true, // 自动调整布局
						scrollBeyondLastLine: false, // 不显示多余滚动空间
						fontSize: 12, // 优化字体大小，更适合阅读
						fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", // 使用更好的等宽字体
						renderLineHighlight: "none", // 不渲染行高亮
						hideCursorInOverviewRuler: true, // 隐藏概览光标
						overviewRulerBorder: false, // 隐藏概览边框
						// 优化滚动条样式 - 更细更美观
						scrollbar: {
							vertical: "auto", // 垂直滚动条自动显示
							horizontal: "auto", // 水平滚动条自动显示
							verticalScrollbarSize: 6, // 更细的垂直滚动条
							horizontalScrollbarSize: 6, // 更细的水平滚动条
							arrowSize: 0, // 完全禁用箭头按钮
							handleMouseWheel: true, // 支持鼠标滚轮
							alwaysConsumeMouseWheel: false, // 允许鼠标滚轮事件冒泡
						},
					}}
					theme="vs" // 使用默认浅色主题
					{...props}
				/>
			</Suspense>
		</div>
	)
}
