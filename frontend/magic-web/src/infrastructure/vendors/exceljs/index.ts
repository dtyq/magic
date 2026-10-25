type ExcelJSModule = typeof import("exceljs")

let excelJsModulePromise: Promise<ExcelJSModule> | null = null

/**
 * Keep every Excel feature on one browser entry and one in-flight Promise.
 * Using the package's non-minified browser build avoids the historical
 * `exceljs.min`/`exceljs` identity split under Rolldown multi-entry builds.
 */
export const loadExcelJS = (): Promise<ExcelJSModule> => {
	if (!excelJsModulePromise) {
		excelJsModulePromise = import(
			// @ts-expect-error ExcelJS does not publish declarations for this browser subpath.
			// eslint-disable-next-line import/extensions
			"exceljs/dist/exceljs.js"
		).then((module) => (module.default ?? module) as ExcelJSModule)
	}

	return excelJsModulePromise
}

export default loadExcelJS
