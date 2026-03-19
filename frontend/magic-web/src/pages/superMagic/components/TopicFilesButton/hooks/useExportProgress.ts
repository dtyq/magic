import { useState, useCallback } from "react"

interface ExportProgressState {
	isExporting: boolean
	progress: number
}

/**
 * useExportProgress - 管理文件导出进度状态
 */
export function useExportProgress() {
	// PDF 导出状态
	const [pdfState, setPdfState] = useState<ExportProgressState>({
		isExporting: false,
		progress: 0,
	})

	// PPT 导出状态
	const [pptState, setPptState] = useState<ExportProgressState>({
		isExporting: false,
		progress: 0,
	})

	// 批量 PDF 导出状态
	const [batchPdfState, setBatchPdfState] = useState<ExportProgressState>({
		isExporting: false,
		progress: 0,
	})

	// 批量 PPT 导出状态
	const [batchPptState, setBatchPptState] = useState<ExportProgressState>({
		isExporting: false,
		progress: 0,
	})

	// PDF 导出回调函数
	const onPdfExportStart = useCallback(() => {
		setPdfState({ isExporting: true, progress: 0 })
	}, [])

	const onPdfExportProgress = useCallback((progress: number) => {
		setPdfState((prev) => ({ ...prev, progress }))
	}, [])

	const onPdfExportEnd = useCallback(() => {
		setPdfState({ isExporting: false, progress: 0 })
	}, [])

	// PPT 导出回调函数
	const onPptExportStart = useCallback(() => {
		setPptState({ isExporting: true, progress: 0 })
	}, [])

	const onPptExportProgress = useCallback((progress: number) => {
		setPptState((prev) => ({ ...prev, progress }))
	}, [])

	const onPptExportEnd = useCallback(() => {
		setPptState({ isExporting: false, progress: 0 })
	}, [])

	// 批量 PDF 导出回调函数
	const onBatchPdfExportStart = useCallback(() => {
		setBatchPdfState({ isExporting: true, progress: 0 })
	}, [])

	const onBatchPdfExportProgress = useCallback((progress: number) => {
		setBatchPdfState((prev) => ({ ...prev, progress }))
	}, [])

	const onBatchPdfExportEnd = useCallback(() => {
		setBatchPdfState({ isExporting: false, progress: 0 })
	}, [])

	// 批量 PPT 导出回调函数
	const onBatchPptExportStart = useCallback(() => {
		setBatchPptState({ isExporting: true, progress: 0 })
	}, [])

	const onBatchPptExportProgress = useCallback((progress: number) => {
		setBatchPptState((prev) => ({ ...prev, progress }))
	}, [])

	const onBatchPptExportEnd = useCallback(() => {
		setBatchPptState({ isExporting: false, progress: 0 })
	}, [])

	// 重置所有导出状态
	const resetExportProgress = useCallback(() => {
		setPdfState({ isExporting: false, progress: 0 })
		setPptState({ isExporting: false, progress: 0 })
		setBatchPdfState({ isExporting: false, progress: 0 })
		setBatchPptState({ isExporting: false, progress: 0 })
	}, [])

	return {
		// PDF 状态
		isExportingPdf: pdfState.isExporting,
		pdfExportProgress: pdfState.progress,

		// PPT 状态
		isExportingPpt: pptState.isExporting,
		pptExportProgress: pptState.progress,

		// 批量 PDF 状态
		isBatchExportingPdf: batchPdfState.isExporting,
		batchPdfExportProgress: batchPdfState.progress,

		// 批量 PPT 状态
		isBatchExportingPpt: batchPptState.isExporting,
		batchPptExportProgress: batchPptState.progress,

		// PDF 回调函数
		onPdfExportStart,
		onPdfExportProgress,
		onPdfExportEnd,

		// PPT 回调函数
		onPptExportStart,
		onPptExportProgress,
		onPptExportEnd,

		// 批量 PDF 回调函数
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,

		// 批量 PPT 回调函数
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,

		// 工具函数
		resetExportProgress,
	}
}
