import { Check, Download, Loader2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import {
	providerModelCategory,
	type ProviderModelCategory,
	type ProviderModelRecord,
} from "@magic-admin-v2/features/platform-model-list/types"
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source"
import { useApis } from "@magic-admin-v2/runtime/context"

export function ModelImportConfig({
	category,
	disabled,
	excludeRecordIds,
	modelId,
	onApply,
}: {
	category: ProviderModelCategory
	disabled: boolean
	excludeRecordIds: ReadonlySet<string>
	modelId: string
	onApply: (record: ProviderModelRecord) => void
}) {
	const { t } = useTranslation()
	const dataSource = useProviderModelDataSource()
	const { platformModel } = useApis()
	const [open, setOpen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [sources, setSources] = useState<ProviderModelRecord[]>([])

	const availableSources = useMemo(
		() => sources.filter((source) => !excludeRecordIds.has(source.id)),
		[excludeRecordIds, sources],
	)

	async function loadSources() {
		if (!modelId.trim() || !dataSource.endpoints.modelImportList || isLoading) {
			if (!modelId.trim()) toast.warning(t("modelList.editor.importSelectModelId"))
			return
		}

		setIsLoading(true)
		try {
			const records = await platformModel.getProviderModelImportSources(
				category === providerModelCategory.embedding ? providerModelCategory.llm : category,
				dataSource,
			)
			setSources(records.filter((record) => record.model_id === modelId.trim()))
			setOpen(true)
		} catch (error) {
			toast.error(
				error instanceof Error && error.message.trim()
					? error.message
					: t("modelList.editor.importLoadFailed"),
			)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				data-testid="platform-model-import-trigger"
				className="mt-2 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
				disabled={disabled || !modelId.trim() || isLoading}
				onClick={() => void loadSources()}
			>
				{isLoading ? (
					<Loader2 className="size-4 animate-spin" aria-hidden="true" />
				) : (
					<Download className="size-4" aria-hidden="true" />
				)}
				{t("modelList.editor.action.importConfig")}
			</PopoverTrigger>
			<PopoverContent
				data-testid="platform-model-list-filter-content"
				align="start"
				className="z-[100] w-[min(560px,calc(100vw-3rem))] p-0"
			>
				<div className="border-b px-3 py-2.5">
					<div className="text-sm font-medium">{t("modelList.editor.importTitle")}</div>
					<div className="mt-1 text-xs text-muted-foreground">
						{t("modelList.editor.importDescription", { modelId })}
					</div>
				</div>
				<div className="max-h-72 overflow-y-auto p-1.5">
					{availableSources.length ? (
						availableSources.map((source) => (
							<button
								data-testid="platform-model-import-option"
								className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
								key={source.id}
								onClick={() => {
									onApply(source)
									setOpen(false)
									toast.success(t("modelList.editor.importSuccess"))
								}}
								type="button"
							>
								<span className="min-w-0">
									<span className="block truncate font-medium">
										{source.translate?.name?.zh_CN ||
											source.name ||
											source.model_id}
									</span>
									<span className="mt-0.5 block truncate text-xs text-muted-foreground">
										{source.provider_code || source.service_provider_config_id}{" "}
										· {source.model_version}
									</span>
								</span>
								<Check
									className="size-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
							</button>
						))
					) : (
						<div className="px-3 py-8 text-center text-sm text-muted-foreground">
							{t("modelList.editor.importEmpty")}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
