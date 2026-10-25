import { useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import MagicModal, { type ModalFuncProps } from "@/components/base/MagicModal"
import type { Topic, Workspace, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type {
	CanvasAssetResourceInfo,
	CanvasAssetMediaType,
	CanvasAssetComplianceState,
	CanvasDesignMethods,
	CanvasOpenEditAssetDialogParams,
	CanvasOpenSaveAssetDialogParams,
	CanvasOpenSaveLocalAssetDialogParams,
	CanvasSaveAssetToLibraryParams,
	CanvasSaveLocalAssetToLibraryParams,
	CanvasStartExistingAssetComplianceParams,
	CanvasStartWorkspaceMediaComplianceParams,
	EraserRequest,
	GenerateExtendedImageRequest,
	IdentifyImageMarkRequest,
	RemoveBackgroundRequest,
} from "@/components/CanvasDesign/public/magic-types"
import { UploadSubDir } from "@/components/CanvasDesign/public/magic-types"
import type { CanvasFileElement } from "@/components/CanvasDesign/runtime/document/types"
import type {
	CanvasResourceReferenceResolverSnapshot,
	ResolveCanvasResourceReference,
} from "@/components/CanvasDesign/public/resource-reference"
import type { GenerateHightImageResponse as ApiGenerateHightImageResponse } from "@/apis/modules/superMagic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { DesignAttachmentIndex } from "../utils/designAttachmentIndex"
import { AssetsApi, SuperMagicApi } from "@/apis"
import {
	buildAssetVisibility,
	normalizeAssetComplianceStatus,
	type AssetComplianceResponse,
	type AssetItem,
	type AssetMediaType,
} from "@/apis/modules/assets"
import { useGetOrCreateImagesDir } from "./useGetOrCreateImagesDir"
import { useImageGeneration } from "./useImageGeneration"
import { useImagePromptCompletion } from "./useImagePromptCompletion"
import { useVideoGeneration } from "./useVideoGeneration"
import { useFileUpload } from "./useFileUpload"
import { useFileInfoProvider } from "./useFileInfoProvider"
import { useCanvasStorage } from "./useCanvasStorage"
import { useConversationAndDownload } from "./useConversationAndDownload"
import {
	useHighImageGeneration,
	toCanvasGenerateHightImageResponse,
} from "./useHighImageGeneration"
import { useDesignFileDropPaths } from "./useDesignFileDropPaths"
import { resolveDesignImagesFileDirWithSlash } from "./resolveDesignImagesFileDirWithSlash"
import { buildAssetComplianceParamsFromAssetItem } from "@/components/CanvasDesign/runtime/resources/asset/buildCreateAssetParamsFromAssetItem"
import { resolveDesignProjectBasePathFromAttachments } from "../utils/utils"
import {
	buildReferenceImageOptions,
	getReferenceImageCrop,
} from "@/components/CanvasDesign/runtime/resources/image/imageCropUtils"
import {
	isAssetResourceScheme,
	parseAssetResourcePath,
	resolveCanvasStorageResourceReference,
} from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"
import { clipboard } from "@/utils/clipboard-helpers"
import { isOssExpiring } from "@/components/CanvasDesign/runtime/resources/offline-cache/ossExpiryUtils"
import type { UseDesignDownloadPolicyResult } from "./useDesignDownloadPolicy"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getPreviewFileUrlWatermarkSignature } from "@/utils/aiWatermarkPreviewFileUrlMode"
import {
	buildDesignResourceReferenceResolverRevision,
	resolveDesignResourceReference,
} from "../utils/designResourceReferenceResolver"
import { assetLibrarySessionStore } from "@/components/CanvasDesign/runtime/resources/asset/AssetLibrarySessionStore"
import { assetDetailStore } from "@/components/CanvasDesign/runtime/resources/asset/AssetDetailStore"
import { resolveUploadAssetMediaType } from "@/components/CanvasDesign/ui/toolbar/asset-library/assetLibraryMedia"

interface UseDesignMethodsOptions {
	/** 将元素投影到当前 Canvas 会话的 effective Content（只读预览时不写回文档） */
	getContentViewElement?: (element: CanvasFileElement) => CanvasFileElement
	projectId?: string
	designProjectId?: string
	selectedTopic?: Topic | null
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 附件快照是否已由入口提供；观测过真实快照后，空数组也可能是一个有效快照 */
	attachmentsReady?: boolean
	/** 附件索引（路径/file_id 快速解析） */
	attachmentIndex?: DesignAttachmentIndex | null
	/** 添加文件到 MessageEditor 的回调函数（已废弃，保留以兼容旧代码） */
	onAddFilesToMessageEditor?: (files: File[]) => Promise<void>
	/** 选中的工作区（用于添加到新话题） */
	selectedWorkspace?: Workspace | null
	/** 选中的项目（用于添加到新话题） */
	selectedProject?: ProjectListItem | null
	/** 添加到当前话题后的回调 */
	afterAddFileToCurrentTopic?: () => void
	/** 添加到新话题后的回调 */
	afterAddFileToNewTopic?: () => void
	/** 退出全屏的回调 */
	onExitFullscreen?: () => void | Promise<void>
	/** 文件列表更新 */
	updateAttachments: () => void
	/** 下载策略（企业版可覆盖） */
	downloadPolicy: UseDesignDownloadPolicyResult
	/** 请求打开素材保存弹窗；提交动作仍由弹窗显式触发。 */
	openSaveAssetToLibraryDialog?: (params: CanvasOpenSaveAssetDialogParams) => void
	openSaveLocalAssetDialog?: (params: CanvasOpenSaveLocalAssetDialogParams) => void
	openEditAssetDialog?: (params: CanvasOpenEditAssetDialogParams) => void
	ensureAssetAgreementSigned?: (options?: { onSigned?: () => void }) => Promise<boolean>
}

function toCanvasAssetMediaType(mediaType: AssetMediaType | null): CanvasAssetMediaType | null {
	switch (mediaType) {
		case "IMAGE":
			return "image"
		case "VIDEO":
			return "video"
		case "AUDIO":
			return "audio"
		default:
			return null
	}
}

function toCanvasAssetResourceInfo(asset: AssetItem): CanvasAssetResourceInfo {
	return {
		assetId: asset.asset_id,
		mediaType: toCanvasAssetMediaType(asset.asset_media_type),
		fileUrl: asset.file_url,
		...(asset.expires_at ? { expiresAt: asset.expires_at } : {}),
		fileName: asset.name || undefined,
		complianceStatus: normalizeAssetComplianceStatus(asset.compliance_status),
		complianceFailedReason: asset.compliance_failed_reason,
	}
}

function toCanvasAssetComplianceState(
	response: AssetComplianceResponse,
): CanvasAssetComplianceState {
	return {
		assetId: response.asset_id,
		status: normalizeAssetComplianceStatus(response.compliance_status),
		failedReason: response.compliance_failed_reason,
	}
}

const ASSET_BATCH_GET_SIZE = 200

/**
 * Canvas Design Methods 聚合器 Hook
 * 职责：组合各个功能 hook，为 CanvasDesign 组件提供统一的 methods 接口
 * - 使用 useImageGeneration 提供图片生成功能
 * - 使用 useVideoGeneration 提供视频模型列表与视频生成/结果查询
 * - 使用 useFileUpload 提供文件上传功能（图片/视频，提示按 uploadSubDir 区分）
 * - 使用 useFileInfoProvider 提供文件信息获取功能
 * - 使用 useCanvasStorage 提供本地存储功能
 * - 使用 useConversationAndDownload 提供添加到对话和下载图片功能
 * - 使用 useDesignFileDropPaths 将项目文件拖拽路径转换为画布存储路径
 */
export function useDesignMethods(options: UseDesignMethodsOptions): CanvasDesignMethods {
	const {
		getContentViewElement,
		projectId,
		designProjectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		onAddFilesToMessageEditor,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		updateAttachments,
		downloadPolicy,
		openSaveAssetToLibraryDialog,
		openSaveLocalAssetDialog,
		openEditAssetDialog,
		ensureAssetAgreementSigned,
	} = options

	const { t } = useTranslation("super")

	const designProjectBasePath = useMemo(
		() =>
			resolveDesignProjectBasePathFromAttachments({
				currentFile,
				flatAttachments,
			}),
		[currentFile, flatAttachments],
	)

	// 使用各个功能 hook（只传递 flatAttachments）
	const { getFileInfo, getFileResourceMeta, getFileInfoById, setFileInfoCache } =
		useFileInfoProvider({
			flatAttachments,
			attachmentsReady,
			designProjectBasePath,
			designProjectId,
			attachmentIndex,
		})

	const getAssetResourceInfo: NonNullable<CanvasDesignMethods["getAssetResourceInfo"]> =
		useCallback(async (assetId, options): Promise<CanvasAssetResourceInfo> => {
			const asset = await assetDetailStore.get(assetId, options)
			return toCanvasAssetResourceInfo(asset)
		}, [])

	const getAssetResourceInfos: NonNullable<CanvasDesignMethods["getAssetResourceInfos"]> =
		useCallback(async (assetIds, options): Promise<CanvasAssetResourceInfo[]> => {
			const normalizedAssetIds = Array.from(
				new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean)),
			)
			if (normalizedAssetIds.length === 0) return []

			const chunks: string[][] = []
			for (let index = 0; index < normalizedAssetIds.length; index += ASSET_BATCH_GET_SIZE) {
				chunks.push(normalizedAssetIds.slice(index, index + ASSET_BATCH_GET_SIZE))
			}

			const assets = await Promise.all(
				chunks.map((chunk) => assetDetailStore.batchGet(chunk, options)),
			)
			return assets.flat().map(toCanvasAssetResourceInfo)
		}, [])

	const getAssetComplianceStatus: NonNullable<CanvasDesignMethods["getAssetComplianceStatus"]> =
		useCallback(async (assetId: string): Promise<CanvasAssetComplianceState> => {
			const response = await AssetsApi.getAssetCompliance(assetId)
			return toCanvasAssetComplianceState(response)
		}, [])
	const getAssetComplianceStatuses: NonNullable<
		CanvasDesignMethods["getAssetComplianceStatuses"]
	> = useCallback(
		async (assetIds: string[]): Promise<CanvasAssetComplianceState[]> => {
			try {
				const responses = await AssetsApi.batchGetAssetCompliance({ asset_ids: assetIds })
				return responses.map(toCanvasAssetComplianceState)
			} catch {
				// Older deployments may not expose the batch endpoint yet. Preserve
				// polling compatibility by falling back to the existing single-item API.
				if (assetIds.length === 0) return []
				return Promise.all(assetIds.map((assetId) => getAssetComplianceStatus(assetId)))
			}
		},
		[getAssetComplianceStatus],
	)

	const getOrCreateImagesDir = useGetOrCreateImagesDir({
		currentFile,
		flatAttachments,
		projectId,
		updateAttachments,
	})

	const {
		getImageModelList,
		generateImage,
		generateImages,
		getImageGenerationResult,
		getImageGenerationResults,
	} = useImageGeneration({
		projectId,
		currentFile,
		flatAttachments,
		designProjectBasePath,
		setFileInfoCache,
		updateAttachments,
		getOrCreateImagesDir,
	})

	const { completeImagePrompt, completeTextContent } = useImagePromptCompletion({
		projectId,
		flatAttachments,
		designProjectBasePath,
	})

	const { getVideoModelList, generateVideo, estimateVideoPoints, getVideoGenerationResult } =
		useVideoGeneration({
			projectId,
			topicId: selectedTopic?.id,
			currentFile,
			flatAttachments,
			designProjectBasePath,
			setFileInfoCache,
			updateAttachments,
		})

	const { uploadFiles, uploadPrivateFiles } = useFileUpload({
		projectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		getFileInfoById,
		setFileInfoCache,
		updateAttachments,
		getOrCreateImagesDir,
	})

	const { getStorage, saveStorage, getRootStorage, saveRootStorage } = useCanvasStorage({
		designProjectId,
	})

	const { addToConversation, downloadFiles } = useConversationAndDownload({
		getContentViewElement,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		onAddFilesToMessageEditor,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		downloadPolicy,
		projectId,
		currentFile,
	})

	const { generateHightImage, getConvertHightConfig } = useHighImageGeneration({
		projectId,
		currentFile,
		designProjectBasePath,
		flatAttachments,
	})

	const getAiAbilityAvailability: NonNullable<CanvasDesignMethods["getAiAbilityAvailability"]> =
		useCallback(() => SuperMagicApi.getAiAbilityAvailability(), [])

	const generateCanvasHightImage: CanvasDesignMethods["generateHightImage"] = useCallback(
		(params) =>
			generateHightImage(params) as ReturnType<CanvasDesignMethods["generateHightImage"]>,
		[generateHightImage],
	)

	const { getDataTransferFileInfo, resolveCanvasClipboardReference } = useDesignFileDropPaths({
		projectId,
		currentFile,
		flatAttachments,
		attachmentsReady,
		attachmentIndex,
		designProjectBasePath,
		updateAttachments,
		getOrCreateImagesDir,
		getFileInfoById,
		setFileInfoCache,
	})

	const resolveResourceReference = useCallback<ResolveCanvasResourceReference>(
		(input, resolveOptions) =>
			resolveDesignResourceReference(
				input,
				{
					designProjectBasePath,
					flatAttachments,
					attachmentIndex,
					attachmentsReady,
				},
				resolveOptions,
			),
		[attachmentIndex, attachmentsReady, designProjectBasePath, flatAttachments],
	)
	const resourceReferenceResolverRevision = useMemo(
		() =>
			buildDesignResourceReferenceResolverRevision({
				projectId,
				designProjectId,
				designProjectBasePath,
				attachmentsReady,
				resourceReferenceSnapshotKey: attachmentIndex?.resourceReferenceSnapshotKey,
			}),
		[
			attachmentIndex?.resourceReferenceSnapshotKey,
			attachmentsReady,
			designProjectBasePath,
			designProjectId,
			projectId,
		],
	)
	const resourceReferenceResolverSnapshot = useMemo<CanvasResourceReferenceResolverSnapshot>(
		() => ({
			revision: resourceReferenceResolverRevision,
			resolve: resolveResourceReference,
		}),
		[resolveResourceReference, resourceReferenceResolverRevision],
	)

	const saveAssetToLibrary: NonNullable<CanvasDesignMethods["saveAssetToLibrary"]> = useCallback(
		async (params: CanvasSaveAssetToLibraryParams): Promise<CanvasAssetResourceInfo> => {
			if (!projectId) {
				throw new Error(t("assetLibrarySave.projectUnavailable"))
			}

			const resolution = resolveCanvasStorageResourceReference(
				params.path,
				resolveResourceReference,
			)
			if (
				resolution.status !== "resolved" ||
				resolution.resourceKind !== "workspace-file" ||
				!resolution.workspacePath
			) {
				throw new Error(t("assetLibrarySave.sourceUnavailable"))
			}

			const asset = await AssetsApi.saveAssetToLibrary({
				name: params.name,
				description: params.description,
				project_id: projectId,
				project_file_path: resolution.workspacePath,
				visibility: buildAssetVisibility(params.userIds, params.departmentIds),
				tag_ids: params.tagIds,
			})
			assetLibrarySessionStore.upsertAsset(asset)

			return toCanvasAssetResourceInfo(asset)
		},
		[projectId, resolveResourceReference, t],
	)

	const startWorkspaceMediaCompliance: NonNullable<
		CanvasDesignMethods["startWorkspaceMediaCompliance"]
	> = useCallback(
		async (
			params: CanvasStartWorkspaceMediaComplianceParams,
		): Promise<CanvasAssetResourceInfo> => {
			if (!projectId) {
				throw new Error(t("assetLibrarySave.projectUnavailable"))
			}
			const name = params.name.trim()
			if (!name) {
				throw new Error(t("assetLibrarySave.sourceUnavailable"))
			}

			const resolution = resolveCanvasStorageResourceReference(
				params.path,
				resolveResourceReference,
			)
			if (
				resolution.status !== "resolved" ||
				resolution.resourceKind !== "workspace-file" ||
				!resolution.workspacePath
			) {
				throw new Error(t("assetLibrarySave.sourceUnavailable"))
			}

			const asset = await AssetsApi.startAssetCompliance({
				asset_kind: "ASSET",
				name,
				project_id: projectId,
				project_file_path: resolution.workspacePath,
			})
			assetLibrarySessionStore.upsertAsset(asset)
			return toCanvasAssetResourceInfo(asset)
		},
		[projectId, resolveResourceReference, t],
	)

	const startExistingAssetCompliance: NonNullable<
		CanvasDesignMethods["startExistingAssetCompliance"]
	> = useCallback(
		async (
			params: CanvasStartExistingAssetComplianceParams,
		): Promise<CanvasAssetResourceInfo> => {
			const assetId = params.assetId.trim()
			if (!assetId) {
				throw new Error(t("assetLibrarySave.sourceUnavailable"))
			}

			const sourceAsset = params.fileKey?.trim()
				? { name: params.name?.trim() || assetId, file_key: params.fileKey }
				: await assetDetailStore.getWithFileKey(assetId)
			const complianceParams = buildAssetComplianceParamsFromAssetItem(sourceAsset)
			if (!complianceParams) {
				throw new Error(t("assetLibrarySave.sourceUnavailable"))
			}

			const asset = await AssetsApi.startAssetCompliance(complianceParams)
			return toCanvasAssetResourceInfo(asset)
		},
		[t],
	)

	const saveLocalAssetToLibrary: NonNullable<CanvasDesignMethods["saveLocalAssetToLibrary"]> =
		useCallback(
			async (
				params: CanvasSaveLocalAssetToLibraryParams,
			): Promise<CanvasAssetResourceInfo> => {
				if (!projectId) {
					throw new Error(t("assetLibrarySave.projectUnavailable"))
				}
				const mediaType = resolveUploadAssetMediaType(params.file.name, ["IMAGE", "VIDEO"])
				if (!mediaType) {
					throw new Error(t("assetLibrarySave.unsupportedFile"))
				}

				const [uploaded] = await uploadFiles(
					[
						{
							file: params.file,
							uploadSubDir:
								mediaType === "VIDEO" ? UploadSubDir.Videos : UploadSubDir.Images,
							overwrite: false,
							onUploadComplete: () => undefined,
							onUploadFailed: () => undefined,
						},
					],
					undefined,
					{ showSuccessToast: false },
				)
				if (!uploaded?.path) {
					throw new Error(t("assetLibrarySave.saveFailed"))
				}

				const resolution = resolveCanvasStorageResourceReference(
					uploaded.path,
					resolveResourceReference,
				)
				if (
					resolution.status !== "resolved" ||
					resolution.resourceKind !== "workspace-file" ||
					!resolution.workspacePath
				) {
					throw new Error(t("assetLibrarySave.sourceUnavailable"))
				}

				const visibility = buildAssetVisibility(params.userIds, params.departmentIds)
				const asset =
					params.mode === "verify"
						? await AssetsApi.startAssetCompliance({
								asset_kind: "ASSET",
								name: params.name,
								description: params.description,
								project_id: projectId,
								project_file_path: resolution.workspacePath,
								tag_ids: params.tagIds,
								visibility,
							})
						: await AssetsApi.saveAssetToLibrary({
								name: params.name,
								description: params.description,
								project_id: projectId,
								project_file_path: resolution.workspacePath,
								visibility,
								tag_ids: params.tagIds,
							})
				assetLibrarySessionStore.upsertAsset(asset)
				return toCanvasAssetResourceInfo(asset)
			},
			[projectId, resolveResourceReference, t, uploadFiles],
		)

	const locateProjectFile: NonNullable<CanvasDesignMethods["locateProjectFile"]> = useCallback(
		(params) => {
			const requestedFileId = params.fileId?.trim()
			const requestedPath = params.filePath?.trim()
			const resolution = requestedFileId
				? resolveResourceReference({
						namespace: "attachment",
						fileId: requestedFileId,
					})
				: requestedPath
					? resolveCanvasStorageResourceReference(
							requestedPath,
							resolveResourceReference,
							{ requireAttachment: true },
						)
					: null

			const fileId = resolution?.status === "resolved" ? resolution.attachmentId : undefined
			if (!fileId) return

			pubsub.publish(PubSubEvents.Update_Active_File_Id, fileId)
			if (params.locateInTree ?? true) {
				pubsub.publish(PubSubEvents.Locate_File_In_Tree, fileId)
			}
		},
		[resolveResourceReference],
	)

	const deleteProjectFiles: NonNullable<CanvasDesignMethods["deleteProjectFiles"]> = useCallback(
		async ({ fileIds }) => {
			if (!projectId) {
				throw new Error(
					t("design.errors.projectUnavailable", "当前项目不可用，请刷新后重试"),
				)
			}
			const result = await SuperMagicApi.deleteFiles({
				file_ids: [...fileIds],
				project_id: projectId,
			})
			updateAttachments()
			return { deletedFileIds: result.file_ids.map(String) }
		},
		[projectId, t, updateAttachments],
	)

	const confirmModal: NonNullable<CanvasDesignMethods["confirmModal"]> = useCallback(
		(options) => {
			const modal = MagicModal.confirm({
				title: options.title,
				content: options.content as ModalFuncProps["content"],
				okText: options.okText,
				cancelText: options.cancelText,
				okButtonProps: options.okButtonProps as ModalFuncProps["okButtonProps"],
				cancelButtonProps: options.cancelButtonProps as ModalFuncProps["cancelButtonProps"],
				variant: options.variant,
				showIcon: options.showIcon,
				onOk: options.onOk,
				onCancel: options.onCancel,
			})
			return {
				update: (update) => modal.update(update as ModalFuncProps),
			}
		},
		[],
	)

	const resolvePrivateUploadApiPath = useCallback(
		(
			path: string,
			errorKey:
				| "design.errors.eraserImagesDirUnresolved"
				| "design.errors.expandImageImagesDirUnresolved",
		) => {
			const resolution = resolveResourceReference({
				namespace: "private-upload-path",
				path,
			})
			if (
				resolution.status !== "resolved" ||
				(resolution.resourceKind !== "private-upload" &&
					resolution.resourceKind !== "external")
			) {
				throw new Error(t(errorKey))
			}
			return resolution.storagePath
		},
		[resolveResourceReference, t],
	)

	/** file_dir / file_path：接口要求带前导 `/` 的工作区 API 路径 */
	const resolveWorkspaceAbsoluteApiPath = useCallback(
		(
			path: string,
			errorKey:
				| "design.errors.designResourcePathUnresolved"
				| "design.errors.removeBackgroundImagesDirUnresolved"
				| "design.errors.eraserImagesDirUnresolved"
				| "design.errors.expandImageImagesDirUnresolved",
			options?: { ensureTrailingSlash?: boolean },
		) => {
			const resolution = resolveCanvasStorageResourceReference(path, resolveResourceReference)
			if (
				resolution.status !== "resolved" ||
				resolution.resourceKind !== "workspace-file" ||
				!resolution.workspacePath
			) {
				throw new Error(t(errorKey))
			}
			return options?.ensureTrailingSlash
				? `${resolution.workspacePath.replace(/\/+$/, "")}/`
				: resolution.workspacePath
		},
		[resolveResourceReference, t],
	)

	const getVirtualResourceScope = useCallback(() => {
		return [selectedWorkspace?.id, projectId].filter(Boolean).join("/")
	}, [projectId, selectedWorkspace?.id])

	const identifyImageMark = useCallback(
		async (params: IdentifyImageMarkRequest) => {
			// 标记识别使用 private 上传后的独立存储地址，不走工作区 API 路径转换。
			return SuperMagicApi.identifyImageMark({
				...params,
				project_id: params.project_id || projectId,
			})
		},
		[projectId],
	)

	const removeBackground = useCallback(
		async (params: RemoveBackgroundRequest) => {
			if (!projectId) {
				throw new Error(t("design.errors.projectIdNotExistsForGenerate"))
			}
			const imageId = params.image_id
			const filePath = params.file_path
			if (!imageId || !filePath) {
				throw new Error(t("design.errors.removeBackgroundParamsIncomplete"))
			}

			let fileDirWithSlash: string | undefined
			if (params.file_dir) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					params.file_dir,
					"design.errors.removeBackgroundImagesDirUnresolved",
					{
						ensureTrailingSlash: true,
					},
				)
			} else {
				fileDirWithSlash = await resolveDesignImagesFileDirWithSlash({
					projectId,
					currentFile,
					flatAttachments,
					updateAttachments,
				})
			}
			if (fileDirWithSlash) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					fileDirWithSlash,
					"design.errors.removeBackgroundImagesDirUnresolved",
					{ ensureTrailingSlash: true },
				)
			}
			if (!fileDirWithSlash) {
				throw new Error(t("design.errors.removeBackgroundImagesDirUnresolved"))
			}

			const filePathWithSlash = resolveWorkspaceAbsoluteApiPath(
				filePath,
				"design.errors.removeBackgroundImagesDirUnresolved",
			)

			const result = await SuperMagicApi.removeBackground({
				project_id: params.project_id || projectId,
				image_id: imageId,
				file_dir: fileDirWithSlash,
				file_path: filePathWithSlash,
				size: params.size,
				reference_image_options: buildReferenceImageOptions({
					filePath: filePathWithSlash,
					crop: getReferenceImageCrop({
						filePath,
						referenceImageOptions: params.reference_image_options,
					}),
				}),
			})
			return toCanvasGenerateHightImageResponse(result as ApiGenerateHightImageResponse)
		},
		[
			projectId,
			currentFile,
			flatAttachments,
			updateAttachments,
			resolveWorkspaceAbsoluteApiPath,
			t,
		],
	)

	const eraser = useCallback(
		async (params: EraserRequest) => {
			if (!projectId) {
				throw new Error(t("design.errors.eraserProjectIdNotExists"))
			}
			const imageId = params.image_id
			const filePath = params.file_path
			const markPath = params.mark_path
			if (!imageId || !filePath || !markPath) {
				throw new Error(t("design.errors.eraserParamsIncomplete"))
			}

			let fileDirWithSlash: string | undefined
			if (params.file_dir) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					params.file_dir,
					"design.errors.eraserImagesDirUnresolved",
					{
						ensureTrailingSlash: true,
					},
				)
			} else {
				fileDirWithSlash = await resolveDesignImagesFileDirWithSlash({
					projectId,
					currentFile,
					flatAttachments,
					updateAttachments,
				})
			}
			if (fileDirWithSlash) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					fileDirWithSlash,
					"design.errors.eraserImagesDirUnresolved",
					{ ensureTrailingSlash: true },
				)
			}
			if (!fileDirWithSlash) {
				throw new Error(t("design.errors.eraserImagesDirUnresolved"))
			}

			const filePathWithSlash = resolveWorkspaceAbsoluteApiPath(
				filePath,
				"design.errors.eraserImagesDirUnresolved",
			)
			const markApiPath = resolvePrivateUploadApiPath(
				markPath,
				"design.errors.eraserImagesDirUnresolved",
			)

			const result = await SuperMagicApi.eraser({
				project_id: params.project_id || projectId,
				image_id: imageId,
				file_dir: fileDirWithSlash,
				file_path: filePathWithSlash,
				mark_path: markApiPath,
				size: params.size,
				reference_image_options: buildReferenceImageOptions({
					filePath: filePathWithSlash,
					crop: getReferenceImageCrop({
						filePath,
						referenceImageOptions: params.reference_image_options,
					}),
				}),
			})
			return toCanvasGenerateHightImageResponse(result as ApiGenerateHightImageResponse)
		},
		[
			projectId,
			currentFile,
			flatAttachments,
			updateAttachments,
			resolveWorkspaceAbsoluteApiPath,
			resolvePrivateUploadApiPath,
			t,
		],
	)

	const expandImage = useCallback(
		async (params: GenerateExtendedImageRequest) => {
			if (!projectId) {
				throw new Error(t("design.errors.expandImageProjectIdNotExists"))
			}
			const imageId = params.image_id
			const filePath = params.file_path
			const canvasPath = params.canvas_path
			const maskPath = params.mask_path
			if (!imageId || !filePath || !canvasPath || !maskPath) {
				throw new Error(t("design.errors.expandImageParamsIncomplete"))
			}

			let fileDirWithSlash: string | undefined
			if (params.file_dir) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					params.file_dir,
					"design.errors.expandImageImagesDirUnresolved",
					{
						ensureTrailingSlash: true,
					},
				)
			} else {
				fileDirWithSlash = await resolveDesignImagesFileDirWithSlash({
					projectId,
					currentFile,
					flatAttachments,
					updateAttachments,
				})
			}
			if (fileDirWithSlash) {
				fileDirWithSlash = resolveWorkspaceAbsoluteApiPath(
					fileDirWithSlash,
					"design.errors.expandImageImagesDirUnresolved",
					{ ensureTrailingSlash: true },
				)
			}
			if (!fileDirWithSlash) {
				throw new Error(t("design.errors.expandImageImagesDirUnresolved"))
			}

			const filePathWithSlash = resolveWorkspaceAbsoluteApiPath(
				filePath,
				"design.errors.expandImageImagesDirUnresolved",
			)
			const canvasApiPath = resolvePrivateUploadApiPath(
				canvasPath,
				"design.errors.expandImageImagesDirUnresolved",
			)
			const maskApiPath = resolvePrivateUploadApiPath(
				maskPath,
				"design.errors.expandImageImagesDirUnresolved",
			)

			const result = await SuperMagicApi.expandImage({
				project_id: params.project_id || projectId,
				image_id: imageId,
				file_dir: fileDirWithSlash,
				file_path: filePathWithSlash,
				canvas_path: canvasApiPath,
				mask_path: maskApiPath,
				size: params.size,
				reference_image_options: buildReferenceImageOptions({
					filePath: filePathWithSlash,
					crop: getReferenceImageCrop({
						filePath,
						referenceImageOptions: params.reference_image_options,
					}),
				}),
			})
			return toCanvasGenerateHightImageResponse(result as ApiGenerateHightImageResponse)
		},
		[
			projectId,
			currentFile,
			flatAttachments,
			updateAttachments,
			resolveWorkspaceAbsoluteApiPath,
			resolvePrivateUploadApiPath,
			t,
		],
	)

	// 组合所有方法到 CanvasDesignMethods 接口
	const methods = useMemo<CanvasDesignMethods>(() => {
		const materializeCanvasClipboardAsset: NonNullable<
			CanvasDesignMethods["materializeCanvasClipboardAsset"]
		> = async (input) => {
			try {
				const assetPathCandidates = [input.sourcePath, input.sourceRef?.src].filter(
					(candidate): candidate is string => Boolean(candidate),
				)
				const assetPath = assetPathCandidates.find(
					(candidate) => parseAssetResourcePath(candidate) !== undefined,
				)
				const assetId = assetPath ? parseAssetResourcePath(assetPath) : undefined
				if (
					assetId === undefined &&
					assetPathCandidates.some((candidate) => isAssetResourceScheme(candidate))
				) {
					return null
				}
				const sourceCanvasId = input.sourceCanvasId?.trim()
				const targetCanvasId = designProjectId?.trim()
				const isSameCanvas = Boolean(
					sourceCanvasId && targetCanvasId && sourceCanvasId === targetCanvasId,
				)
				// Legacy payloads did not always carry sourceCanvasId. In that case the
				// path can still be resolved against the current canvas; an explicit
				// different source canvas remains blocked to avoid path collisions.
				const canResolveCurrentCanvasPath = !sourceCanvasId || isSameCanvas
				let sourceUrl =
					input.sourceRef?.ossUrl ||
					(/^https?:\/\//i.test(input.sourceRef?.src ?? "")
						? input.sourceRef?.src
						: /^https?:\/\//i.test(input.sourcePath ?? "")
							? input.sourcePath
							: undefined)
				let sourceUrlIsExpiring = isOssExpiring(input.sourceRef?.expiresAt)
				if (assetId !== undefined) {
					// Asset references are organization-scoped logical IDs rather than
					// canvas-relative files, so they remain resolvable across canvases.
					// Always ask the asset service for the current signed URL and media
					// type instead of trusting a serialized temporary URL.
					const asset = await getAssetResourceInfo(assetId, {
						forceRefresh: sourceUrlIsExpiring,
					})
					if (
						asset.assetId !== assetId ||
						!asset.fileUrl ||
						!asset.mediaType ||
						!input.mimeType.toLowerCase().startsWith(`${asset.mediaType}/`)
					) {
						return null
					}
					sourceUrl = asset.fileUrl
					sourceUrlIsExpiring = false
				}
				if (
					(!sourceUrl || sourceUrlIsExpiring) &&
					input.sourcePath &&
					canResolveCurrentCanvasPath &&
					assetId === undefined
				) {
					const refreshed = await getFileInfo(input.sourcePath, {
						useImageProcess: false,
						forceRefresh: sourceUrlIsExpiring,
					})
					sourceUrl = refreshed?.src
					sourceUrlIsExpiring = isOssExpiring(refreshed?.expires_at)
				}
				// A path from another canvas must never be resolved through the current
				// canvas attachment index: an identical relative path could refer to a
				// different file. Cross-canvas transfers therefore require an inline
				// Blob or a still-valid signed source URL until the host supplies a
				// source-canvas resource resolver.
				if (!sourceUrl || sourceUrlIsExpiring) return null
				const response = await fetch(sourceUrl, { cache: "default" })
				if (!response.ok) return null
				const blob = await response.blob()
				if (blob.size > 200 * 1024 * 1024) return null
				return new File([blob], input.fileName, {
					type: blob.type || input.mimeType,
				})
			} catch {
				return null
			}
		}
		return {
			getImageModelList,
			completeImagePrompt,
			completeTextContent,
			getVideoModelList,
			generateVideo,
			estimateVideoPoints,
			generateImage,
			generateImages,
			removeBackground,
			eraser,
			expandImage,
			generateHightImage: generateCanvasHightImage,
			getConvertHightConfig,
			getAiAbilityAvailability,
			getImageGenerationResult,
			getImageGenerationResults,
			getVideoGenerationResult,
			locateProjectFile,
			deleteProjectFiles,
			uploadFiles,
			getFileInfo,
			getFileResourceMeta,
			getAssetResourceInfo,
			getAssetResourceInfos,
			getAssetComplianceStatus,
			getAssetComplianceStatuses,
			openSaveAssetToLibraryDialog,
			openSaveLocalAssetDialog,
			openEditAssetDialog,
			saveLocalAssetToLibrary,
			ensureAssetAgreementSigned,
			saveAssetToLibrary,
			startWorkspaceMediaCompliance,
			startExistingAssetCompliance,
			resolveResourceReference: resourceReferenceResolverSnapshot.resolve,
			resourceReferenceResolverSnapshot,
			resourceReferenceResolverVersion: resourceReferenceResolverSnapshot.revision,
			getVirtualResourceScope,
			getImageProcessCacheSignature: getPreviewFileUrlWatermarkSignature,
			addToConversation,
			downloadFiles,
			getStorage,
			saveStorage,
			getRootStorage,
			saveRootStorage,
			getDataTransferFileInfo,
			identifyImageMark,
			uploadPrivateFiles,
			confirmModal,
			clipboard: {
				write: clipboard.write,
				readText:
					typeof navigator !== "undefined" && navigator.clipboard?.readText
						? navigator.clipboard.readText.bind(navigator.clipboard)
						: undefined,
				read:
					typeof navigator !== "undefined" && navigator.clipboard?.read
						? navigator.clipboard.read.bind(navigator.clipboard)
						: undefined,
			},
			materializeCanvasClipboardAsset,
			getCanvasClipboardContext: () => ({
				projectId,
				canvasId: designProjectId,
			}),
			resolveCanvasClipboardReference,
		}
	}, [
		getImageModelList,
		completeImagePrompt,
		completeTextContent,
		getVideoModelList,
		generateVideo,
		estimateVideoPoints,
		generateImage,
		generateImages,
		removeBackground,
		eraser,
		expandImage,
		generateCanvasHightImage,
		getConvertHightConfig,
		getAiAbilityAvailability,
		getImageGenerationResult,
		getImageGenerationResults,
		getVideoGenerationResult,
		locateProjectFile,
		deleteProjectFiles,
		uploadFiles,
		getFileInfo,
		getFileResourceMeta,
		getAssetResourceInfo,
		getAssetResourceInfos,
		getAssetComplianceStatus,
		getAssetComplianceStatuses,
		openSaveAssetToLibraryDialog,
		openSaveLocalAssetDialog,
		openEditAssetDialog,
		saveLocalAssetToLibrary,
		ensureAssetAgreementSigned,
		saveAssetToLibrary,
		startWorkspaceMediaCompliance,
		startExistingAssetCompliance,
		designProjectId,
		resourceReferenceResolverSnapshot,
		getVirtualResourceScope,
		addToConversation,
		downloadFiles,
		getStorage,
		saveStorage,
		getRootStorage,
		saveRootStorage,
		getDataTransferFileInfo,
		resolveCanvasClipboardReference,
		projectId,
		identifyImageMark,
		uploadPrivateFiles,
		confirmModal,
	])

	return methods
}
