import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { observer } from "mobx-react-lite"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { userStore } from "@/models/user"
import { SelfMediaBrandRecordService } from "@/services/selfMedia"
import { SelfMediaFileStorageService } from "../../services/SelfMediaFileStorageService"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import StepBrandInfo from "./steps/StepBrandInfo"
import type { BrandAutoSaveStatus, StepBrandInfoRef } from "./steps/StepBrandInfo"
import StepTopicAndDetail from "./steps/StepTopicAndDetail"
import StepConfirm from "./steps/StepConfirm"
import StepIndicator from "./steps/StepIndicator"
import StepNavigation from "./steps/StepNavigation"
import TemplateSelector from "./steps/TemplateSelector"
import { useDraftManager } from "./hooks/useDraftManager"
import { useConfirmFooterState } from "./hooks/useConfirmFooterState"
import { useStepHeaderCompact } from "./hooks/useStepHeaderCompact"
import { useSelfMediaBrandConfig } from "../../hooks/useSelfMediaBrandConfig"
import { STEPS } from "./constants"
import { getProceedHint } from "./utils/getProceedHint"
import type { ArticleDetail, BrandImageItem } from "./types"
import type { AttachmentNode } from "../../services"
import DraftRestoreDialog from "./components/ui/DraftRestoreDialog"
import ClearDataConfirmDialog from "./components/ui/ClearDataConfirmDialog"
import DraftLoadingState from "./components/ui/DraftLoadingState"

interface SelfMediaInitPanelProps {
	selectedProject?: { id: string } | null
	folderFileId?: string
	folderPath?: string
	attachmentList?: AttachmentNode[]
	onBackHome?: () => void
}

function SelfMediaInitPanel({
	selectedProject,
	folderFileId,
	folderPath,
	attachmentList,
	onBackHome,
}: SelfMediaInitPanelProps) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const userId = userStore.user.userInfo?.user_id || ""
	const organizationCode = userStore.user.organizationCode || ""
	const projectId = selectedProject?.id || ""
	const reduceMotion = useReducedMotion()

	const fileStorageService = useMemo(
		() =>
			projectId
				? new SelfMediaFileStorageService(projectId, folderFileId, folderPath, fileApi)
				: null,
		[projectId, folderFileId, folderPath, fileApi],
	)

	const brandService = useMemo(
		() =>
			userId && organizationCode
				? new SelfMediaBrandRecordService(userId, organizationCode)
				: null,
		[userId, organizationCode],
	)

	const {
		settings: brandSettings,
		setSettings: setBrandSettings,
		saveSettings: saveBrandSettings,
		isLoading: isBrandConfigLoading,
		isSaving: isBrandConfigSaving,
	} = useSelfMediaBrandConfig({ fileStorageService })

	const brandDirtyRef = useRef(false)
	const brandIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const latestBrandRef = useRef(brandSettings)
	const saveBrandSettingsRef = useRef(saveBrandSettings)
	const clearDataConfirmingRef = useRef(false)
	const draftDiscardingRef = useRef(false)
	const [brandAutoSaveStatus, setBrandAutoSaveStatus] = useState<BrandAutoSaveStatus>("idle")
	const [showClearConfirm, setShowClearConfirm] = useState(false)
	const [isClearDataConfirming, setIsClearDataConfirming] = useState(false)
	const [isDraftDiscarding, setIsDraftDiscarding] = useState(false)
	useEffect(() => {
		saveBrandSettingsRef.current = saveBrandSettings
	}, [saveBrandSettings])

	const flushBrandSave = useCallback(() => {
		if (brandIdleTimerRef.current) {
			clearTimeout(brandIdleTimerRef.current)
			brandIdleTimerRef.current = null
		}
		if (!brandDirtyRef.current) return
		brandDirtyRef.current = false
		setBrandAutoSaveStatus("saving")
		void saveBrandSettingsRef
			.current(latestBrandRef.current)
			.then(() => {
				setBrandAutoSaveStatus("saved")
			})
			.catch(() => {
				brandDirtyRef.current = true
				setBrandAutoSaveStatus("failed")
			})
	}, [])

	const markBrandDirty = useCallback(() => {
		brandDirtyRef.current = true
		if (fileStorageService) {
			setBrandAutoSaveStatus("pending")
		}
		if (brandIdleTimerRef.current) {
			clearTimeout(brandIdleTimerRef.current)
		}
		brandIdleTimerRef.current = setTimeout(() => {
			brandIdleTimerRef.current = null
			flushBrandSave()
		}, 5000)
	}, [fileStorageService, flushBrandSave])

	useEffect(() => {
		return () => {
			if (brandIdleTimerRef.current) {
				clearTimeout(brandIdleTimerRef.current)
			}
			// Flush on unmount if dirty
			if (brandDirtyRef.current) {
				brandDirtyRef.current = false
				void saveBrandSettingsRef.current(latestBrandRef.current)
			}
		}
	}, [])

	const {
		data,
		setData,
		currentStep,
		setCurrentStep,
		showTemplateSelector,
		pendingDraft,
		templates,
		isDraftLoading,
		brandImagesUploading,
		setBrandImagesUploading,
		handleLoadTemplate,
		handleStartBlank,
		handleRestoreDraft,
		handleDiscardDraft,
		hasDraftContent,
		debouncedSaveDraft,
		saveDraftInBackground,
		handleClearData,
		skipDraftPersistenceRef,
		dataRef,
		currentStepRef,
	} = useDraftManager({ fileStorageService, attachmentList })

	const brandInfoRef = useRef<StepBrandInfoRef>(null)

	useEffect(() => {
		setData((prev) => ({
			...prev,
			global: brandSettings,
		}))
	}, [brandSettings, setData])

	useEffect(() => {
		brandDirtyRef.current = false
		setBrandAutoSaveStatus("idle")
	}, [projectId, folderFileId, folderPath])

	const handleBrandChange = useCallback(
		(field: "author" | "brandPosition" | "targetAudience", value: string) => {
			const nextGlobal = { ...dataRef.current.global, [field]: value }
			dataRef.current = { ...dataRef.current, global: nextGlobal }
			latestBrandRef.current = nextGlobal
			setData((prev) => ({
				...prev,
				global: nextGlobal,
			}))
			setBrandSettings(nextGlobal)
			markBrandDirty()
		},
		[dataRef, markBrandDirty, setBrandSettings, setData],
	)

	const handleBrandImagesChange = useCallback(
		(brandImages: BrandImageItem[]) => {
			const nextGlobal = { ...dataRef.current.global, brandImages }
			dataRef.current = { ...dataRef.current, global: nextGlobal }
			latestBrandRef.current = nextGlobal
			setData((prev) => ({
				...prev,
				global: nextGlobal,
			}))
			setBrandSettings(nextGlobal)
			markBrandDirty()
		},
		[dataRef, markBrandDirty, setBrandSettings, setData],
	)

	const handleArticlesChange = useCallback(
		(articles: ArticleDetail[]) => {
			setData((prev) => ({ ...prev, articles }))
		},
		[setData],
	)

	const handleArticleUpdate = useCallback(
		(index: number, article: ArticleDetail) => {
			setData((prev) => {
				const newArticles = [...prev.articles]
				newArticles[index] = article
				return { ...prev, articles: newArticles }
			})
		},
		[setData],
	)

	const navigateToStep = useCallback(
		(step: number) => {
			flushBrandSave()
			setCurrentStep(step)
			saveDraftInBackground(step)
		},
		[flushBrandSave, saveDraftInBackground, setCurrentStep],
	)

	const handleNext = useCallback(() => {
		if (currentStep === 0 && brandInfoRef.current) {
			const canProceedNow = brandInfoRef.current.checkBeforeNext()
			if (!canProceedNow) return
		}

		flushBrandSave()
		const nextStep = Math.min(currentStep + 1, STEPS.length - 1)
		setCurrentStep(nextStep)
		saveDraftInBackground(nextStep)
	}, [currentStep, flushBrandSave, saveDraftInBackground, setCurrentStep])

	const handlePrev = useCallback(() => {
		flushBrandSave()
		const prevStep = Math.max(currentStep - 1, 0)
		setCurrentStep(prevStep)
		saveDraftInBackground(prevStep)
	}, [currentStep, flushBrandSave, saveDraftInBackground, setCurrentStep])

	const hasPendingBrandImageUploads = data.global.brandImages.some(
		(img) => img.file.size > 0 && !img.uploadedPath,
	)
	const hasAnyInitData = showTemplateSelector || currentStep > 0 || hasDraftContent
	const effectiveBrandAutoSaveStatus: BrandAutoSaveStatus = isBrandConfigSaving
		? "saving"
		: brandAutoSaveStatus

	const handleBackHome = useCallback(() => {
		flushBrandSave()
		onBackHome?.()
	}, [flushBrandSave, onBackHome])

	const {
		action: confirmFooterAction,
		isExecutionLocked: isConfirmExecutionLocked,
		setAction: setConfirmFooterAction,
		setIsExecutionLocked: setIsConfirmExecutionLocked,
	} = useConfirmFooterState(currentStep)
	const { isCompact: isStepHeaderCompact, setViewportRef: setContentViewportRef } =
		useStepHeaderCompact(currentStep, showTemplateSelector)

	const handleDiscardDraftWithFeedback = useCallback(async () => {
		if (draftDiscardingRef.current) return
		draftDiscardingRef.current = true
		setIsDraftDiscarding(true)
		try {
			await handleDiscardDraft()
		} finally {
			draftDiscardingRef.current = false
			setIsDraftDiscarding(false)
		}
	}, [handleDiscardDraft])

	const handleConfirmClearData = useCallback(async () => {
		if (clearDataConfirmingRef.current) return
		clearDataConfirmingRef.current = true
		setIsClearDataConfirming(true)
		try {
			await handleClearData()
			setShowClearConfirm(false)
		} finally {
			clearDataConfirmingRef.current = false
			setIsClearDataConfirming(false)
		}
	}, [handleClearData])

	const canProceed = (): boolean => {
		switch (currentStep) {
			case 0:
				return !brandImagesUploading && !hasPendingBrandImageUploads
			case 1:
				return (
					data.articles.length > 0 &&
					data.articles.every((a) => a.title.trim() !== "" && !!a.platform)
				)
			default:
				return true
		}
	}

	const handleSaveTemplate = fileStorageService
		? async (name: string) => {
				await fileStorageService.saveTemplate(data, name)
			}
		: undefined

	const handleArchiveDraftBeforeGenerate = fileStorageService
		? async () => {
				skipDraftPersistenceRef.current = true
				try {
					const archiveId = await fileStorageService.archiveDraft(
						dataRef.current,
						currentStepRef.current,
					)
					if (!archiveId) {
						throw new Error("Failed to archive draft before generation")
					}
				} catch (error) {
					skipDraftPersistenceRef.current = false
					throw error
				}
			}
		: undefined

	return (
		<div
			className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
			style={{
				background:
					"linear-gradient(145deg, rgba(255, 255, 255, 0.52), transparent 40%), #f8f8f9",
			}}
			data-testid="self-media-init-panel-root"
		>
			<DraftRestoreDialog
				open={Boolean(pendingDraft)}
				onRestore={handleRestoreDraft}
				onDiscard={() => void handleDiscardDraftWithFeedback()}
				onBackHome={handleBackHome}
				isDiscarding={isDraftDiscarding}
			/>
			<ClearDataConfirmDialog
				open={showClearConfirm}
				isConfirming={isClearDataConfirming}
				onCancel={() => setShowClearConfirm(false)}
				onConfirm={() => void handleConfirmClearData()}
			/>
			{isDraftLoading || isBrandConfigLoading ? (
				<DraftLoadingState />
			) : (
				<div
					className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto]"
					data-testid="self-media-init-panel-shell"
				>
					<StepIndicator
						currentStep={currentStep}
						onNavigate={navigateToStep}
						compact={isStepHeaderCompact}
					/>

					<ScrollArea
						className="relative min-h-0 overflow-y-auto bg-transparent"
						data-testid="self-media-init-panel-content"
						viewportRef={setContentViewportRef}
					>
						<div className="px-4 sm:px-6" data-self-media-motion="step-content">
							<AnimatePresence mode="wait" initial={false}>
								<motion.div
									key={showTemplateSelector ? "template-selector" : currentStep}
									initial={reduceMotion ? false : { opacity: 0, y: 8 }}
									animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
									exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
									transition={{
										duration: reduceMotion ? 0 : 0.22,
										ease: "easeOut",
									}}
								>
									{showTemplateSelector && (
										<TemplateSelector
											templates={templates}
											onLoadTemplate={handleLoadTemplate}
											onStartBlank={handleStartBlank}
										/>
									)}

									{!showTemplateSelector && (
										<>
											{currentStep === 0 && (
												<StepBrandInfo
													ref={brandInfoRef}
													author={data.global.author}
													brandPosition={data.global.brandPosition}
													targetAudience={data.global.targetAudience}
													brandImages={data.global.brandImages}
													onChange={handleBrandChange}
													onBrandImagesChange={handleBrandImagesChange}
													fileStorageService={fileStorageService}
													brandService={brandService}
													attachmentList={attachmentList}
													onBrandImagesUploadingChange={
														setBrandImagesUploading
													}
													onConfirmNext={handleNext}
													brandImageUploadTarget="brand"
													brandAutoSaveStatus={
														effectiveBrandAutoSaveStatus
													}
												/>
											)}
											{currentStep === 1 && (
												<StepTopicAndDetail
													articles={data.articles}
													onChange={handleArticlesChange}
													onArticleUpdate={handleArticleUpdate}
													globalSettings={data.global}
													onPersistDraft={debouncedSaveDraft}
													fileStorageService={fileStorageService}
												/>
											)}
											{currentStep === 2 && (
												<StepConfirm
													data={data}
													selectedProject={selectedProject}
													folderFileId={folderFileId}
													folderPath={folderPath}
													attachmentList={attachmentList}
													onSaveTemplate={handleSaveTemplate}
													onArchiveDraft={
														handleArchiveDraftBeforeGenerate
													}
													onGenerateFailed={() => {
														skipDraftPersistenceRef.current = false
													}}
													onBackHome={handleBackHome}
													onFooterActionChange={setConfirmFooterAction}
													onExecutionLockedChange={
														setIsConfirmExecutionLocked
													}
												/>
											)}
										</>
									)}
								</motion.div>
							</AnimatePresence>
						</div>
					</ScrollArea>

					{!isConfirmExecutionLocked ? (
						<StepNavigation
							currentStep={currentStep}
							canProceed={canProceed()}
							hasAnyInitData={hasAnyInitData}
							proceedHint={getProceedHint({
								t,
								currentStep,
								brandImagesUploading,
								hasPendingBrandImageUploads,
								articles: data.articles,
							})}
							onNext={handleNext}
							onPrev={handlePrev}
							onClear={() => setShowClearConfirm(true)}
							onNavigate={navigateToStep}
							onBackHome={handleBackHome}
							finalAction={
								currentStep === STEPS.length - 1 ? confirmFooterAction : null
							}
						/>
					) : null}
				</div>
			)}
		</div>
	)
}

export default observer(SelfMediaInitPanel)
