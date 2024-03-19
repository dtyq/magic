// 按需加载方式
export const loadReactPdf = () =>
	import("react-pdf").then((m) => {
		// 初始化 worker 配置
		if (m.pdfjs?.GlobalWorkerOptions) {
			m.pdfjs.GlobalWorkerOptions.workerSrc = "/packages/pdfjs/pdf.worker.min.mjs"
		}
		return m.pdfjs
	})

// 使用示例
async function loadPackage() {
	return await loadReactPdf()
}
export default loadPackage
