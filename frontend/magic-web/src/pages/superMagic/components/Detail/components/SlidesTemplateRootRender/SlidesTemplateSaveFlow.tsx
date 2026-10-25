import { useState } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	createAvailableSlidesTemplateCode,
	mySlidesTemplateAdapter,
	MySlidesTemplateAdapterUnavailableError,
} from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import type { SlidesTemplateProjectContext } from "./types"
import {
	SaveSlidesTemplateDialog,
	type SaveSlidesTemplateTarget,
} from "../../../TopicFilesButton/components"
import type { SlidesTemplateItem } from "../../../MainInputContainer/scenes/Slides/slidesTemplateState"

interface SlidesTemplateSaveFlowProps {
	project: SlidesTemplateProjectContext
	projectId?: string
	onSaved?: () => void
}

export function useSlidesTemplateSaveFlow({
	project,
	projectId,
	onSaved,
}: SlidesTemplateSaveFlowProps) {
	const { t } = useTranslation("super")
	const [isSaving, setIsSaving] = useState(false)
	const [saveDialogOpen, setSaveDialogOpen] = useState(false)
	const [saveDialogTemplates, setSaveDialogTemplates] = useState<SlidesTemplateItem[]>([])
	const [saveDialogTarget, setSaveDialogTarget] = useState<SaveSlidesTemplateTarget>("new")
	const [saveDialogLoading, setSaveDialogLoading] = useState(false)
	const [saveDialogError, setSaveDialogError] = useState("")
	const [saveDialogNotice, setSaveDialogNotice] = useState("")

	async function loadSaveDialogTemplates() {
		setSaveDialogLoading(true)
		setSaveDialogError("")
		try {
			const result = await mySlidesTemplateAdapter.listMine({ page: 1, pageSize: 100 })
			setSaveDialogTemplates(result.items)
		} catch {
			setSaveDialogError(t("mySlidesTemplates.loadFailedDescription"))
		} finally {
			setSaveDialogLoading(false)
		}
	}

	function openSaveDialog(notice = "") {
		setSaveDialogNotice(notice)
		setSaveDialogTarget("new")
		setSaveDialogError("")
		setSaveDialogOpen(true)
		if (!notice) void loadSaveDialogTemplates()
	}

	async function startSave() {
		if (isSaving) return
		if (!projectId) {
			magicToast.error(t("slidesTemplatePreview.save.failed"))
			return
		}
		openSaveDialog(
			mySlidesTemplateAdapter.saveEnabled ? "" : t("slidesTemplatePreview.save.unavailable"),
		)
	}

	async function saveSelectedTemplate() {
		if (!projectId || isSaving || saveDialogNotice) return
		setIsSaving(true)
		try {
			const code =
				saveDialogTarget === "new"
					? await createAvailableSlidesTemplateCode()
					: saveDialogTarget
			await mySlidesTemplateAdapter.saveFromFolder({
				projectId,
				directoryId: project.rootFileId,
				code,
			})
			setSaveDialogOpen(false)
			magicToast.success(t("slidesTemplatePreview.save.success"))
			onSaved?.()
		} catch (error) {
			if (error instanceof MySlidesTemplateAdapterUnavailableError) {
				magicToast.info(t("slidesTemplatePreview.save.unavailable"))
			} else {
				magicToast.error(t("slidesTemplatePreview.save.failed"))
			}
		} finally {
			setIsSaving(false)
		}
	}

	const dialogs = (
		<SaveSlidesTemplateDialog
			open={saveDialogOpen}
			onOpenChange={setSaveDialogOpen}
			templates={saveDialogTemplates}
			selectedTarget={saveDialogTarget}
			onSelectedTargetChange={setSaveDialogTarget}
			isLoading={saveDialogLoading}
			isSaving={isSaving}
			notice={saveDialogNotice}
			error={saveDialogError}
			onRetry={() => {
				setSaveDialogNotice("")
				void loadSaveDialogTemplates()
			}}
			onSave={() => void saveSelectedTemplate()}
		/>
	)

	return { isSaving, startSave, dialogs }
}
