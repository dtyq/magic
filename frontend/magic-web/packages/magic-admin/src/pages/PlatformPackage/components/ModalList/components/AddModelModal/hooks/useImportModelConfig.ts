import { useEffect, useState, type RefObject } from "react"
import type { FormInstance } from "antd"
import { Form, message } from "antd"
import { useMemoizedFn, useRequest } from "ahooks"
import { useTranslation } from "react-i18next"
import { AiModel } from "@admin/const/aiModel"
import type { AiManage } from "@admin/types/aiManage"
import { useApis } from "@admin/apis"
import type { ImportStatus } from "../components/ImportModelCard"
import {
	buildAddModelInitialValues,
	getImportSourceProviderName,
	type ImportSourceModel,
} from "../utils"
import { LangConfig } from "../constant"
import { NormalizedPricingTemplate } from "../pricingTemplate"

type PanelPosition = {
	top: number
	left: number
}

export interface UseImportModelConfigOptions {
	form: FormInstance
	icons: AiManage.Icon[]
	category?: AiModel.ServiceProviderCategory | null
	excludeModelId?: string
	modalPanelRef: RefObject<HTMLDivElement | null>
	initialFormValues: Record<string, any> | null
	setLangConfig: React.Dispatch<React.SetStateAction<AiManage.TranslateConfig>>
	defaultPricingTemplate?: NormalizedPricingTemplate | null
}

export const useImportModelConfig = ({
	form,
	icons,
	category,
	excludeModelId,
	modalPanelRef,
	initialFormValues,
	setLangConfig,
	defaultPricingTemplate,
}: UseImportModelConfigOptions) => {
	const { t } = useTranslation("admin/ai/model")
	const { PlatformPackageApi } = useApis()

	const selectedModelId = Form.useWatch(["model_id"], form)

	const [importSources, setImportSources] = useState<ImportSourceModel[]>([])
	const [selectedImportSourceId, setSelectedImportSourceId] = useState<string>()
	const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false)
	const [importStatus, setImportStatus] = useState<ImportStatus>(null)
	const [importPanelPosition, setImportPanelPosition] = useState<PanelPosition | null>(null)

	const { runAsync: queryImportSources, loading: importSourceLoading } = useRequest(
		async (modelId: string) => {
			const res = await PlatformPackageApi.getAllModelList({
				...(category ? { category } : {}),
			})

			return (res || []).filter(
				(item) =>
					item.model_id === modelId && (!excludeModelId || item.id !== excludeModelId),
			) as ImportSourceModel[]
		},
		{ manual: true },
	)

	const resetImportState = useMemoizedFn(() => {
		setImportSources([])
		setSelectedImportSourceId(undefined)
		setSourcePopoverOpen(false)
		setImportStatus(null)
		setImportPanelPosition(null)
	})

	useEffect(() => {
		resetImportState()
	}, [selectedModelId, resetImportState])

	useEffect(() => {
		if (!sourcePopoverOpen) {
			setImportPanelPosition(null)
			return
		}

		const updatePanelPosition = () => {
			const modalPanel = modalPanelRef.current
			if (!modalPanel) return
			const rect = modalPanel.getBoundingClientRect()
			setImportPanelPosition({
				top: rect.top,
				left: rect.right + 10,
			})
		}

		updatePanelPosition()

		let resizeObserver: ResizeObserver | undefined
		const rafId = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				updatePanelPosition()
				const modalPanel = modalPanelRef.current
				if (!modalPanel) return
				resizeObserver = new ResizeObserver(updatePanelPosition)
				resizeObserver.observe(modalPanel)
			})
		})

		window.addEventListener("resize", updatePanelPosition)
		window.addEventListener("scroll", updatePanelPosition, true)

		return () => {
			cancelAnimationFrame(rafId)
			resizeObserver?.disconnect()
			window.removeEventListener("resize", updatePanelPosition)
			window.removeEventListener("scroll", updatePanelPosition, true)
		}
	}, [sourcePopoverOpen, modalPanelRef])

	// 应用导入源
	const applyImportSource = useMemoizedFn((source: ImportSourceModel) => {
		const mergedValues = buildAddModelInitialValues({
			info: source,
			modelType: source.model_type,
			category,
			defaultPricingTemplate,
		})

		form.setFieldsValue(mergedValues)
		const iconKey = icons.find((icon) => icon.url === source.icon)?.key
		form.setFieldValue("icon", iconKey)
		setLangConfig(source.translate || LangConfig)
		setImportStatus({
			type: "success",
			text: t("form.importedSourceStatus", {
				provider: getImportSourceProviderName(source),
				name: source.model_version || source.model_id,
			}),
		})
	})

	// 查询相同模型ID的导入源
	const handleQueryImportSources = useMemoizedFn(async () => {
		if (!selectedModelId) {
			message.warning(t("form.selectModelIdFirst"))
			return
		}

		try {
			const sources = await queryImportSources(selectedModelId)
			setImportSources(sources)

			if (sources.length === 0) {
				setImportStatus({
					type: "empty",
					text: t("form.noHistoryConfigFound"),
				})
				setSourcePopoverOpen(false)
				return
			}

			setImportStatus(null)
			setSelectedImportSourceId(sources[0]?.id)
			setSourcePopoverOpen(true)
		} catch (error) {
			message.error(t("form.loadImportSourceFailed"))
			console.error("query import sources error:", error)
		}
	})

	// 确认导入
	const handleConfirmImport = useMemoizedFn(() => {
		const selectedSource = importSources.find((item) => item.id === selectedImportSourceId)
		if (!selectedSource) return
		applyImportSource(selectedSource)
	})

	// 重置为空白
	const handleResetToBlank = useMemoizedFn(() => {
		form.resetFields()
		form.setFieldsValue(initialFormValues)
		setLangConfig(LangConfig)
		resetImportState()
	})

	return {
		selectedModelId,
		importStatus,
		importSourceLoading,
		handleQueryImportSources,
		handleResetToBlank,
		resetImportState,
		popover: {
			open: sourcePopoverOpen,
			position: importPanelPosition,
			loading: importSourceLoading,
			sources: importSources,
			selectedSourceId: selectedImportSourceId,
			onSelect: setSelectedImportSourceId,
			onConfirm: handleConfirmImport,
			onClose: () => setSourcePopoverOpen(false),
		},
	}
}
