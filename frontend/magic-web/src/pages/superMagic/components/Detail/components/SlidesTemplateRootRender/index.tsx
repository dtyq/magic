import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { AlertCircle } from "lucide-react"
import { SuperMagicApi } from "@/apis"
import MagicSpin from "@/components/base/MagicSpin"
import { Button } from "@/components/shadcn-ui/button"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { createSlidesTemplateStructureAdapter } from "./templateStructureAdapter"
import { loadSlidesTemplateProject, stringifySlidesTemplateManifest } from "./templateProject"
import {
	getSlidesTemplateSyncKey,
	SLIDES_TEMPLATE_PROJECT_RELOAD_DEBOUNCE_MS,
} from "./templateRootSync"
import SlidesTemplatePreviewHeader from "./SlidesTemplatePreviewHeader"
import SlidesTemplateSettingsDialog from "./SlidesTemplateSettingsDialog"
import { useSlidesTemplateSaveFlow } from "./SlidesTemplateSaveFlow"
import type { SlidesTemplateManifest, SlidesTemplateProjectContext } from "./types"
import PPTRootRender from "../PPTRootRender"
import type { PPTRootRenderProps } from "../PPTRootRender/types"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"

function findAttachmentById(
	items: AttachmentItem[] | undefined,
	fileId: string,
): AttachmentItem | undefined {
	for (const item of items || []) {
		if (String(item.file_id || "") === fileId) return item
		const child = findAttachmentById(item.children, fileId)
		if (child) return child
	}
	return undefined
}

function getTemplateTitle(
	manifest: SlidesTemplateManifest,
	language: string,
	fallback: string,
): string {
	const localized = manifest.label || {}
	const isEnglish = language.toLowerCase().startsWith("en")
	return (
		(isEnglish ? localized.en_US : localized.zh_CN) ||
		(isEnglish ? localized.zh_CN : localized.en_US) ||
		manifest.template_id ||
		fallback
	)
}

interface SlidesTemplateReadyProps {
	project: SlidesTemplateProjectContext
	props: PPTRootRenderProps
}

function SlidesTemplateReady({ project, props }: SlidesTemplateReadyProps) {
	const { i18n } = useTranslation("super")
	const { isShareRoute } = useShareRoute()
	// Slide-source reads carry the ambient identity for read-only share previews.
	const fileApi = useFileApi()
	const [manifest, setManifest] = useState(project.manifest)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const manifestRef = useRef(project.manifest)
	const projectId = props.selectedProject?.id || props.projectId
	const allowEdit = props.allowEdit !== false && !isShareRoute

	useEffect(() => {
		manifestRef.current = project.manifest
		setManifest(project.manifest)
	}, [project.manifest])

	const saveManifest = useCallback(
		async (nextManifest: SlidesTemplateManifest) => {
			await SuperMagicApi.saveFileContent([
				{
					file_id: project.manifestFileId,
					content: stringifySlidesTemplateManifest(nextManifest),
					enable_shadow: true,
				},
			])
			manifestRef.current = nextManifest
			setManifest(nextManifest)
		},
		[project.manifestFileId],
	)

	const getManifest = useCallback(() => manifestRef.current, [])
	const slideStructureAdapter = useMemo(
		() =>
			createSlidesTemplateStructureAdapter({
				project,
				projectId,
				getManifest,
				saveManifest,
				fileApi,
			}),
		[project, projectId, getManifest, saveManifest, fileApi],
	)
	const { isSaving, startSave, dialogs } = useSlidesTemplateSaveFlow({
		project,
		projectId,
	})
	const fallbackName =
		project.root.file_name ||
		project.root.filename ||
		project.root.name ||
		project.root.display_filename ||
		project.rootPath.split("/").filter(Boolean).pop() ||
		project.rootFileId
	const title = getTemplateTitle(manifest, i18n?.language || "zh_CN", fallbackName)
	const displayConfig = useMemo(
		() => ({ type: "slide" as const, slides: manifest.slides.map((slide) => slide.file) }),
		[manifest.slides],
	)

	return (
		<div className="flex h-full min-h-0 w-full flex-col bg-background">
			{!props.isFullscreen ? (
				<SlidesTemplatePreviewHeader
					isSaving={isSaving}
					onOpenSettings={allowEdit ? () => setSettingsOpen(true) : undefined}
					onSaveToMyTemplates={isShareRoute ? undefined : () => void startSave()}
					title={title}
				/>
			) : null}
			<div className="min-h-0 flex-1">
				<PPTRootRender
					{...props}
					className="h-full"
					data={{
						...props.data,
						file_id: project.rootFileId,
						display_config: displayConfig,
					}}
					displayConfig={displayConfig}
					slideStructureAdapter={slideStructureAdapter}
					disableMagicProjectLookup
				/>
			</div>
			{allowEdit ? (
				<SlidesTemplateSettingsDialog
					manifest={manifest}
					open={settingsOpen}
					onOpenChange={setSettingsOpen}
					onSave={saveManifest}
				/>
			) : null}
			{dialogs}
		</div>
	)
}

export default function SlidesTemplateRootRender(props: PPTRootRenderProps) {
	const { t } = useTranslation("super")
	// Bind the template manifest read at this boundary so share previews do not
	// stall on the leaf guard while waiting for a share identity.
	const fileApi = useFileApi()
	const fileAccess = useFileAccess()
	const [project, setProject] = useState<SlidesTemplateProjectContext>()
	const [error, setError] = useState<Error>()
	const [reloadKey, setReloadKey] = useState(0)
	const rootId = String(props.data?.file_id || "")
	const root = useMemo(() => {
		return (
			findAttachmentById(props.attachments as AttachmentItem[] | undefined, rootId) ||
			findAttachmentById(props.attachmentList as AttachmentItem[] | undefined, rootId) ||
			(props.data as AttachmentItem)
		)
	}, [props.attachmentList, props.attachments, props.data, rootId])
	const syncKey = useMemo(() => getSlidesTemplateSyncKey(root), [root])
	const projectRef = useRef<SlidesTemplateProjectContext | undefined>(undefined)
	const loadedSyncKeyRef = useRef("")
	const loadedReloadKeyRef = useRef(reloadKey)
	projectRef.current = project

	useEffect(() => {
		if (!root) return
		if (shouldWaitForShareAccess(fileAccess)) return
		const isRetry = reloadKey !== loadedReloadKeyRef.current
		if (!isRetry && loadedSyncKeyRef.current === syncKey && projectRef.current) return

		let cancelled = false
		const delay =
			projectRef.current && !isRetry ? SLIDES_TEMPLATE_PROJECT_RELOAD_DEBOUNCE_MS : 0
		const timer = window.setTimeout(() => {
			if (cancelled) return
			loadedSyncKeyRef.current = syncKey
			loadedReloadKeyRef.current = reloadKey
			setError(undefined)
			// Keep the last preview mounted while this template reloads.
			if (!projectRef.current) setProject(undefined)
			loadSlidesTemplateProject(root, fileApi)
				.then((result) => {
					if (!cancelled) setProject(result)
				})
				.catch((reason) => {
					if (!cancelled)
						setError(reason instanceof Error ? reason : new Error(String(reason)))
				})
		}, delay)

		return () => {
			cancelled = true
			window.clearTimeout(timer)
		}
	}, [reloadKey, root, syncKey, fileApi, fileAccess])

	if (error) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-background p-6">
				<div className="flex max-w-md flex-col items-center gap-3 text-center">
					<AlertCircle className="size-8 text-destructive" aria-hidden="true" />
					<div className="text-base font-medium">
						{t("fileViewer.slidesTemplateLoadFailed")}
					</div>
					<div className="text-sm text-muted-foreground">
						{t("fileViewer.slidesTemplateLoadFailedDescription")}
					</div>
					{error.message && (
						<div
							className="max-w-full break-words rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground"
							data-testid="slides-template-load-error-detail"
						>
							{t("fileViewer.slidesTemplateLoadFailedReason", {
								reason: error.message,
							})}
						</div>
					)}
					<Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>
						{t("fileViewer.retry")}
					</Button>
				</div>
			</div>
		)
	}

	if (!project) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-background">
				<MagicSpin spinning />
			</div>
		)
	}

	return <SlidesTemplateReady key={project.rootFileId} project={project} props={props} />
}
