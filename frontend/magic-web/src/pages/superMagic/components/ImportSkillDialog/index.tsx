import { memo, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from "@/components/shadcn-ui/alert-dialog"
import { Button } from "@/components/shadcn-ui/button"
import StepIndicator from "./components/StepIndicator"
import FileUploadStep from "./components/FileUploadStep"
import IdentityStep from "./components/IdentityStep"
import { createInitialSkillIdentityData, normalizeSkillI18nText } from "./types"
import type { UploadedFile, SkillIdentityData } from "./types"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useUpload } from "@/hooks/useUploadFiles"
import { skillsService } from "@/services/skills/SkillsService"
import type {
	ImportSkillResponse,
	ParseSkillResponse,
	SkillSourceType,
} from "@/apis/modules/skills"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	IMPORT_SKILL_DROP_ERROR,
	ImportSkillDropError,
	createSkillArchiveFromSelectedFolderFiles,
	normalizeSkillImportFile,
	resolveDroppedSkillImportFile,
} from "./utils"

interface ImportSkillDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** Called after a skill is successfully imported, with the import result */
	onSuccess?: (result: ImportSkillResponse) => void | Promise<void>
	importSourceType?: SkillSourceType
}

// 0=upload, 1=identity — maps to indicator steps 0 and 1
type ContentView = "upload" | "identity"

const INITIAL_IDENTITY: SkillIdentityData = createInitialSkillIdentityData()

const INDICATOR_STEP: Record<ContentView, number> = {
	upload: 0,
	identity: 1,
}

/** Map backend parse response to the identity form's initial data */
function mapParseResultToIdentity(r: ParseSkillResponse): SkillIdentityData {
	return {
		iconUrl: r.logo || undefined,
		name: normalizeSkillI18nText(r.name_i18n, r.package_name),
		description: normalizeSkillI18nText(r.description_i18n, r.package_description),
	}
}

function ImportSkillDialog({
	open,
	onOpenChange,
	onSuccess,
	importSourceType,
}: ImportSkillDialogProps) {
	const { t } = useTranslation("crew/market")

	const [view, setView] = useState<ContentView>("upload")
	const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
	const [identity, setIdentity] = useState<SkillIdentityData>(INITIAL_IDENTITY)
	const [duplicateSkillName, setDuplicateSkillName] = useState<string | null>(null)
	const [parseResult, setParseResult] = useState<ParseSkillResponse | null>(null)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const indicatorSteps = [
		{ label: t("importSkill.steps.skillFile") },
		{ label: t("importSkill.steps.completeInfo") },
	]

	// Skill package file → private bucket
	const { upload } = useUpload({
		storageType: "private",
		onProgress: (_, percent) =>
			setUploadedFile((prev) => (prev ? { ...prev, progress: percent } : null)),
	})

	// Skill icon → public bucket (must be publicly accessible for display)
	const { upload: uploadPublic } = useUpload({ storageType: "public" })

	const handlePreparedFile = useCallback(
		async (file: File) => {
			setView("upload")
			setParseResult(null)
			setDuplicateSkillName(null)
			setUploadedFile({ file, progress: 0, status: "uploading" })

			const { fullfilled, rejected } = await upload([
				{ name: file.name, file, status: "init" },
			])

			if (rejected.length > 0 || fullfilled.length === 0) {
				setUploadedFile((prev) => (prev ? { ...prev, status: "error" } : null))
				return
			}

			const fileKey = fullfilled[0].value.key

			try {
				const result = await skillsService.parseSkillFile(fileKey)
				setParseResult(result)
				setIdentity(mapParseResultToIdentity(result))
				setUploadedFile((prev) =>
					prev ? { ...prev, progress: 100, status: "done" } : null,
				)
				// Auto-advance: show duplicate alert or navigate directly to identity step
				if (result.is_update) {
					setDuplicateSkillName(result.package_name)
				} else {
					setView("identity")
				}
			} catch {
				setUploadedFile((prev) => (prev ? { ...prev, status: "error" } : null))
				magicToast.error(t("importSkill.errors.parseFailed"))
			}
		},
		[upload, t],
	)

	const handleFileSelect = useCallback(
		async (file: File) => {
			const normalizedFile = await normalizeSkillImportFile(file)
			await handlePreparedFile(normalizedFile)
		},
		[handlePreparedFile],
	)

	const handleDropDataTransfer = useCallback(
		async (dataTransfer: DataTransfer) => {
			try {
				const droppedItem = await resolveDroppedSkillImportFile(dataTransfer)
				if (!droppedItem) return

				if (droppedItem.kind === "folder") {
					await handlePreparedFile(droppedItem.file)
					return
				}

				const normalizedFile = await normalizeSkillImportFile(droppedItem.file)
				await handlePreparedFile(normalizedFile)
			} catch (error) {
				if (
					error instanceof ImportSkillDropError &&
					error.code === IMPORT_SKILL_DROP_ERROR.MULTIPLE_ITEMS
				) {
					magicToast.warning(t("importSkill.errors.singleItemOnly"))
					return
				}

				if (
					error instanceof ImportSkillDropError &&
					error.code === IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER
				) {
					magicToast.error(t("importSkill.errors.emptyFolder"))
					return
				}

				magicToast.error(t("importSkill.errors.archiveFailed"))
			}
		},
		[handlePreparedFile, t],
	)

	const handleFolderSelect = useCallback(
		async (files: File[]) => {
			try {
				const archiveFile = await createSkillArchiveFromSelectedFolderFiles(files)
				await handlePreparedFile(archiveFile)
			} catch (error) {
				if (
					error instanceof ImportSkillDropError &&
					error.code === IMPORT_SKILL_DROP_ERROR.EMPTY_FOLDER
				) {
					magicToast.error(t("importSkill.errors.emptyFolder"))
					return
				}

				magicToast.error(t("importSkill.errors.archiveFailed"))
			}
		},
		[handlePreparedFile, t],
	)

	const handleFileRemove = useCallback(() => {
		setUploadedFile(null)
		setParseResult(null)
	}, [])

	function handleClose() {
		onOpenChange(false)
		setTimeout(() => {
			setView("upload")
			setUploadedFile(null)
			setIdentity(INITIAL_IDENTITY)
			setDuplicateSkillName(null)
			setParseResult(null)
			setIsSubmitting(false)
		}, 300)
	}

	function handleNext() {
		if (parseResult?.is_update) {
			setDuplicateSkillName(parseResult.package_name)
		} else {
			setView("identity")
		}
	}

	function handleBack() {
		setView("upload")
	}

	async function handleConfirm() {
		if (!parseResult) return
		setIsSubmitting(true)
		try {
			let logo = identity.iconUrl

			// Upload new icon to the public bucket if the user changed it
			if (identity.iconFile) {
				const { fullfilled } = await uploadPublic([
					{ name: identity.iconFile.name, file: identity.iconFile, status: "init" },
				])
				if (fullfilled.length > 0) logo = fullfilled[0].value.key
			}

			const result = await skillsService.importSkill({
				import_token: parseResult.import_token,
				name_i18n: identity.name,
				description_i18n: identity.description,
				logo,
				...(importSourceType ? { source_type: importSourceType } : {}),
			})

			await onSuccess?.(result)
			handleClose()
		} catch {
			console.error("importSkill.errors.importFailed")
			// magicToast.error(t("importSkill.errors.importFailed"))
		} finally {
			setIsSubmitting(false)
		}
	}

	const canGoNext = uploadedFile?.status === "done"

	return (
		<>
			<Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
				<DialogContent
					className="w-[586px] !max-w-[586px] gap-0 p-0"
					data-testid="import-skill-dialog"
					onInteractOutside={(event) => event.preventDefault()}
					onPointerDownOutside={(event) => event.preventDefault()}
				>
					<DialogHeader className="border-b border-border px-3 py-3">
						<DialogTitle className="text-base font-semibold">
							{t("importSkill.title")}
						</DialogTitle>
					</DialogHeader>

					<ScrollArea className="flex h-[452px] flex-col gap-2.5 overflow-y-auto p-4">
						{/* Visual 2-step indicator; highlights step 0 or step 1 based on content view */}
						<StepIndicator steps={indicatorSteps} currentStep={INDICATOR_STEP[view]} />

						{view === "upload" && (
							<FileUploadStep
								uploadedFile={uploadedFile}
								onFileSelect={handleFileSelect}
								onFolderSelect={handleFolderSelect}
								onDropDataTransfer={handleDropDataTransfer}
								onFileRemove={handleFileRemove}
							/>
						)}

						{view === "identity" && (
							<IdentityStep identity={identity} onChange={setIdentity} />
						)}
					</ScrollArea>

					<DialogFooter className="border-t border-border px-3 py-3">
						<div className="flex items-center gap-1.5">
							<Button
								variant="outline"
								size="sm"
								onClick={handleClose}
								data-testid="import-skill-cancel-button"
							>
								{t("importSkill.buttons.cancel")}
							</Button>

							{view === "identity" && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleBack}
									data-testid="import-skill-back-button"
								>
									{t("importSkill.buttons.back")}
								</Button>
							)}

							{view === "upload" && (
								<Button
									size="sm"
									disabled={!canGoNext}
									onClick={handleNext}
									data-testid="import-skill-next-button"
								>
									{t("importSkill.buttons.next")}
								</Button>
							)}

							{view === "identity" && (
								<Button
									size="sm"
									disabled={isSubmitting}
									onClick={handleConfirm}
									data-testid="import-skill-confirm-button"
								>
									{t("importSkill.buttons.confirm")}
								</Button>
							)}
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Shown when an uploaded skill name conflicts with an existing one */}
			<AlertDialog
				open={!!duplicateSkillName}
				onOpenChange={(v) => !v && setDuplicateSkillName(null)}
			>
				<AlertDialogContent data-testid="update-skill-dialog">
					<AlertDialogHeader>
						<AlertDialogTitle>{t("updateSkill.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("updateSkill.description", { name: duplicateSkillName })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel data-testid="update-skill-cancel">
							{t("updateSkill.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setDuplicateSkillName(null)
								setView("identity")
							}}
							data-testid="update-skill-continue"
						>
							{t("updateSkill.continue")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default memo(ImportSkillDialog)
