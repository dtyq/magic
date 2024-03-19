// 按需加载方式
export const loadExcelJS = () =>
	import(
		// @ts-ignore
		"exceljs/dist/exceljs.min"
	).then((m) => m.default)

// 使用示例
async function loadPackage() {
	return await loadExcelJS()
}
export default loadPackage
