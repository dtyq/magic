import { useEffect, useMemo, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { MagicFSApi, SuperMagicApi } from "@/apis"
import projectFilesStore from "@/stores/projectFiles"
import magicToast from "@/components/base/MagicToaster/utils"
import { createFileApi, useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	createSessionFileAccess,
	isSharePageLocation,
} from "@/pages/superMagic/fileAccess/fileAccessContext"
import { requestProjectAttachmentsFullRefresh } from "@/pages/superMagic/services/attachmentsTopicSync"
import type { AttachmentItem } from "../../../../TopicFilesButton/hooks/types"
import { findMagicProjectJsFile } from "../../../contents/HTML/utils/magicProjectFileFinder"
import {
	parseMagicProjectJs,
	generateUpdatedMagicProjectJs,
	generateBlankSlideContent,
} from "../../../contents/HTML/utils/magicProjectUpdater"
import { normalizeHiddenSlides } from "@/pages/superMagic/utils/pptHiddenSlides"
import { createPPTFileMutationClient, PPTFileMutationError } from "../services/pptFileMutation"
import type { PPTStore } from "../stores/PPTStore"
import { moveSelectedToGap, selectSlideRange } from "../utils/slideSelection"
import {
	applyPPTTransitionEdit,
	getPPTTransitionsSignature,
	reconcilePPTTransitions,
	type PPTTransitionEdit,
} from "../utils/pptTransitions"

interface Options {
	store: PPTStore
	allowEdit: boolean
	mainFileId?: string
	mainFileName?: string
	projectId?: string
	attachmentList?: AttachmentItem[]
	onDeckConfigSaved?: (config: Record<string, unknown>) => void
	beforeWrite: () => Promise<boolean>
}

/** One owner for ordinary-deck structure writes. No optimistic deletion or retry of stale content. */
export function usePPTDeckTools(options: Options) {
	const {
		store,
		mainFileId,
		mainFileName,
		projectId,
		attachmentList = [],
		onDeckConfigSaved,
	} = options
	const { t } = useTranslation("super")
	const ambientFileApi = useFileApi()
	const sharePage = isSharePageLocation()
	// Ordinary project previews can predate FileAccessProvider. Bind their known
	// project explicitly; a missing share provider must never borrow session access.
	const fileApi = useMemo(
		() =>
			ambientFileApi.identityKey === "none" && projectId && !sharePage
				? createFileApi(createSessionFileAccess({ projectId }))
				: ambientFileApi,
		[ambientFileApi, projectId, sharePage],
	)
	const alive = useRef(true)
	const current = useRef(options)
	current.current = options
	// Old operations must not borrow the permissions or store of the next deck.
	const scope = useMemo(
		() => ({ store, mainFileId, projectId, fileApi }),
		[store, mainFileId, projectId, fileApi],
	)
	const activeScope = useRef(scope)
	activeScope.current = scope
	const isActive = () =>
		alive.current &&
		activeScope.current === scope &&
		current.current.allowEdit &&
		fileApi.identityKey.startsWith("session:")
	useEffect(() => {
		alive.current = true
		return () => {
			alive.current = false
		}
	}, [])
	const client = useMemo(
		() =>
			createPPTFileMutationClient(fileApi, {
				isCurrent: () =>
					alive.current && activeScope.current === scope && current.current.allowEdit,
			}),
		[fileApi, scope],
	)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [selecting, setSelecting] = useState(false)
	const anchor = useRef("")
	const pending = useRef(false)
	const retainedCreatedFiles = useRef(new Set<string>())
	const [busy, setBusy] = useState(false)
	const cancelRequested = useRef(false)
	useEffect(() => {
		setSelected(new Set())
		setSelecting(false)
		anchor.current = ""
	}, [scope])
	const ids = store.slides.map((slide) => store.getFileIdByPath(slide.path) || "")
	const signature = ids.join(",")
	useEffect(() => {
		const valid = new Set(signature.split(",").filter(Boolean))
		setSelected((previous) => new Set([...previous].filter((id) => valid.has(id))))
	}, [signature])
	const select = (id: string, range = false) => {
		if (!id || busy) return
		setSelecting(true)
		setSelected((previous) => {
			if (range && anchor.current)
				return new Set([...previous, ...selectSlideRange(ids, anchor.current, id)])
			const next = new Set(previous)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
		anchor.current = id
	}
	const hidden = normalizeHiddenSlides(
		store.slidePaths,
		store.getConfigForExport().displayConfig?.hidden_slides,
	)
	const run = useMemoizedFn(async (operation: () => Promise<void>) => {
		if (pending.current || !isActive()) return
		let ownsOperation = false
		try {
			// The action was chosen against this order and visibility, before any
			// unsaved-edit prompt. Do not rebase that intent onto a remote update
			// received while the prompt or the existing sync queue is pending.
			const expectedPaths = store.slidePaths.slice()
			const expectedHidden = normalizeHiddenSlides(
				expectedPaths,
				store.getConfigForExport().displayConfig?.hidden_slides,
			)
			// A dirty transition panel may save through this same writer while resolving
			// the guard. Reserve the writer only afterwards to avoid a reentrant deadlock.
			if (!(await current.current.beforeWrite()) || !isActive() || pending.current) return
			pending.current = true
			ownsOperation = true
			retainedCreatedFiles.current.clear()
			cancelRequested.current = false
			setBusy(true)
			await store.syncManager.waitForCompletion()
			if (!isActive() || cancelRequested.current) return
			const currentPaths = store.slidePaths
			const currentHidden = normalizeHiddenSlides(
				currentPaths,
				store.getConfigForExport().displayConfig?.hidden_slides,
			)
			if (
				expectedPaths.length !== currentPaths.length ||
				expectedPaths.some((path, index) => path !== currentPaths[index]) ||
				expectedHidden.length !== currentHidden.length ||
				expectedHidden.some((path, index) => path !== currentHidden[index])
			)
				throw new PPTFileMutationError("conflict")
			await operation()
		} catch (error) {
			if (isActive()) {
				if (error instanceof PPTFileMutationError && error.kind === "conflict")
					magicToast.error(t("ppt.batch.operationConflict"))
				else if (error instanceof PPTFileMutationError && error.kind === "unknown")
					magicToast.error(t("ppt.batch.operationUnknown"))
				else magicToast.error(t("ppt.batch.operationFailed"))
			}
		} finally {
			if (ownsOperation && isActive() && retainedCreatedFiles.current.size) {
				magicToast.info(
					t("ppt.batch.filesRetained", { count: retainedCreatedFiles.current.size }),
				)
				if (projectId)
					requestProjectAttachmentsFullRefresh({
						projectId,
						reason: "ppt-retained-copies",
					})
			}
			if (ownsOperation) {
				pending.current = false
				if (alive.current) setBusy(false)
			}
		}
	})
	const loadManifest = async () => {
		if (!isActive()) throw new Error("PPT operation is stale")
		const expectedPaths = store.slidePaths.slice()
		const expectedHidden = hidden.slice()
		const file = await findMagicProjectJsFile({
			attachments: attachmentList,
			currentFileId: mainFileId || "",
			currentFileName: mainFileName || "",
		})
		if (!file) throw new Error("PPT manifest is unavailable")
		const snapshot = await client.read(file.fileId)
		const parsed = parseMagicProjectJs(snapshot.content)
		// Do not silently rebase user intent onto a deck changed by another writer.
		if (
			!parsed ||
			JSON.stringify(parsed.slides) !== JSON.stringify(expectedPaths) ||
			JSON.stringify(normalizeHiddenSlides(parsed.slides, parsed.config.hidden_slides)) !==
				JSON.stringify(expectedHidden)
		)
			throw new Error("PPT structure changed; reload before editing")
		return { snapshot, config: parsed.config as Record<string, unknown>, paths: parsed.slides }
	}
	const commit = async (
		manifest: Awaited<ReturnType<typeof loadManifest>>,
		paths: string[],
		hiddenPaths: string[],
		transitions: unknown = manifest.config.transitions,
		showToast = true,
	) => {
		if (!isActive() || cancelRequested.current) return false
		const config = {
			...manifest.config,
			slides: paths,
			hidden_slides: normalizeHiddenSlides(paths, hiddenPaths),
			...(transitions !== undefined
				? { transitions: reconcilePPTTransitions(transitions, paths) }
				: {}),
		}
		await client.save(manifest.snapshot, generateUpdatedMagicProjectJs(config, paths))
		if (!isActive()) return false
		// Apply only a confirmed result, preserving the current page by its path.
		const activePath = store.currentSlide?.path
		// Reconcile through the store so surviving pages retain their HTML, thumbnails,
		// and renderer identity. setSlides(string[]) rebuilds them by their old indices.
		onDeckConfigSaved?.(config)
		await store.updateConfig({
			displayConfig: { ...store.getConfigForExport().displayConfig, ...config },
		})
		if (!isActive()) return false
		const activeIndex = store.slides.findIndex((slide) => slide.path === activePath)
		if (activeIndex >= 0 && activeIndex !== store.activeIndex) store.setActiveIndex(activeIndex)
		if (projectId)
			requestProjectAttachmentsFullRefresh({ projectId, reason: "ppt-deck-operation" })
		if (showToast) magicToast.success(t("ppt.batch.saved"))
		return true
	}
	const setTransitions = async (edit: PPTTransitionEdit): Promise<boolean> => {
		let saved = false
		await run(async () => {
			const manifest = await loadManifest()
			// Compare the panel's opening snapshot, not a newer version borrowed during save.
			if (
				JSON.stringify(edit.expectedPaths) !== JSON.stringify(manifest.paths) ||
				getPPTTransitionsSignature(edit.expectedTransitions) !==
					getPPTTransitionsSignature(manifest.config.transitions)
			) {
				throw new PPTFileMutationError("conflict")
			}
			const transitions = applyPPTTransitionEdit(
				manifest.config.transitions,
				manifest.paths,
				edit,
			)
			saved = await commit(
				manifest,
				manifest.paths,
				normalizeHiddenSlides(manifest.paths, manifest.config.hidden_slides),
				transitions,
				false,
			)
		})
		return saved
	}
	const pathsFor = (targetIds: ReadonlySet<string>) => {
		const paths = store.slides
			.filter((slide) => targetIds.has(store.getFileIdByPath(slide.path) || ""))
			.map((slide) => slide.path)
		if (paths.length !== targetIds.size || !paths.length)
			throw new Error("Selection no longer exists")
		return paths
	}
	const setHidden = (value: boolean, targets: ReadonlySet<string> = selected) =>
		run(async () => {
			const paths = pathsFor(targets)
			const manifest = await loadManifest()
			const next = new Set(
				normalizeHiddenSlides(manifest.paths, manifest.config.hidden_slides),
			)
			paths.forEach((path) => (value ? next.add(path) : next.delete(path)))
			await commit(manifest, manifest.paths, [...next])
		})
	const remove = (targets: ReadonlySet<string> = selected) =>
		run(async () => {
			const paths = new Set(pathsFor(targets))
			const manifest = await loadManifest()
			const remaining = manifest.paths.filter((path) => !paths.has(path))
			if (!remaining.length) {
				magicToast.error(t("fileViewer.cannotDeleteLastSlide"))
				return
			}
			// Removal is a manifest operation. Source HTML and shared assets stay recoverable.
			if (await commit(manifest, remaining, hidden)) setSelected(new Set())
		})
	const reorder = (nextPaths: string[]) =>
		run(async () => {
			const manifest = await loadManifest()
			if (
				nextPaths.length !== manifest.paths.length ||
				new Set(nextPaths).size !== manifest.paths.length ||
				nextPaths.some((path) => !manifest.paths.includes(path))
			)
				throw new Error("Stale reorder")
			await commit(manifest, nextPaths, hidden)
		})
	const move = (gap: number) => {
		const next = moveSelectedToGap(
			store.slides,
			selected,
			(slide) => store.getFileIdByPath(slide.path) || "",
			gap,
		)
		return reorder(next.map((slide) => slide.path))
	}
	const createPages = (targets: ReadonlySet<string> | null, insertAt?: number) =>
		run(async () => {
			if (!projectId) return
			const sourcePaths = targets ? pathsFor(targets) : []
			const sources = (targets ? sourcePaths : [""]).map((path) => ({
				path,
				fileId: path ? store.getFileIdByPath(path) : undefined,
			}))
			const manifest = await loadManifest()
			// Blank slide paths are relative to magic.project.js, just as in the
			// existing insertSlide flow. This also works when the deck has no pages.
			const manifestFile = targets
				? null
				: (await MagicFSApi.getFileInfo(manifest.snapshot.fileId)).file
			if (
				manifestFile &&
				(manifestFile.id !== manifest.snapshot.fileId || !manifestFile.parent_id)
			)
				throw new Error("PPT folder is unavailable")
			const copies: string[] = []
			const transitionCopies: Array<{ from: string; to: string }> = []
			const hiddenCopies: string[] = []
			const createdIds: string[] = []
			const names = new Set(
				attachmentList.map((file) => `${file.parent_id}/${file.file_name}`),
			)
			for (const { path: sourcePath, fileId: sourceId } of sources) {
				if (cancelRequested.current || !isActive()) break
				const sourceFile = targets
					? attachmentList.find((file) => String(file.file_id) === sourceId)
					: { parent_id: manifestFile?.parent_id, file_name: "slide.html" }
				if ((targets && !sourceId) || !sourceFile?.parent_id || !sourceFile.file_name)
					throw new Error("Source folder is unavailable")
				const source = targets && sourceId ? await client.read(sourceId) : null
				const base = targets ? sourceFile.file_name.replace(/\.html$/i, "") : "slide"
				let number = 1
				while (names.has(`${sourceFile.parent_id}/${base} (${number}).html`)) number++
				const fileName = `${base} (${number}).html`
				names.add(`${sourceFile.parent_id}/${fileName}`)
				if (cancelRequested.current || !isActive()) break
				// Server must reject collisions; never reuse an existing same-name node.
				const newFile = (await SuperMagicApi.createFile({
					project_id: projectId,
					parent_id: sourceFile.parent_id,
					file_name: fileName,
					is_directory: false,
					ignore_duplicate: false,
				})) as AttachmentItem
				if (!newFile?.file_id || String(newFile.file_id) === sourceId)
					throw new Error("Copy identity is invalid")
				const fileId = String(newFile.file_id)
				retainedCreatedFiles.current.add(fileId)
				await client.initializeCreatedFile(
					fileId,
					source?.content ??
						generateBlankSlideContent({ slideTitle: t("fileViewer.addNewSlide") }),
				)
				if (!isActive()) return
				projectFilesStore.addWorkspaceFile(newFile)
				const path = targets ? sourcePath.replace(/[^/]+$/, fileName) : fileName
				store.pathMappingService.setPathFileIdMapping(path, fileId)
				copies.push(path)
				if (targets) transitionCopies.push({ from: sourcePath, to: path })
				createdIds.push(fileId)
				if (targets && hidden.includes(sourcePath)) hiddenCopies.push(path)
			}
			if (!copies.length || cancelRequested.current || !isActive()) return
			const gap = targets
				? Math.max(...sourcePaths.map((path) => manifest.paths.indexOf(path))) + 1
				: Math.min(Math.max(insertAt ?? manifest.paths.length, 0), manifest.paths.length)
			const paths = [...manifest.paths.slice(0, gap), ...copies, ...manifest.paths.slice(gap)]
			const transitions = transitionCopies.reduce(
				(config, duplicatePath) =>
					reconcilePPTTransitions(config, paths, { duplicatePath }),
				manifest.config.transitions,
			)
			// A failed/unknown manifest commit must never trigger blind deletion of created files.
			if (await commit(manifest, paths, [...hidden, ...hiddenCopies], transitions)) {
				retainedCreatedFiles.current.clear()
				setSelected(new Set(createdIds))
				setSelecting(Boolean(targets))
				store.setActiveIndex(gap)
			}
		})
	return {
		selected,
		isAllSelected: selected.size > 0 && ids.every((id) => !id || selected.has(id)),
		deselectAll: () => setSelected(new Set()),
		selecting,
		setSelecting,
		select,
		busy,
		client,
		clearSelection: () => {
			setSelected(new Set())
			setSelecting(false)
		},
		selectAll: () => {
			setSelecting(true)
			setSelected(new Set(ids.filter(Boolean)))
		},
		setHidden,
		setTransitions,
		remove,
		reorder,
		move,
		duplicate: (targets?: ReadonlySet<string>) => createPages(targets ?? selected),
		insert: (index: number, direction: "before" | "after") =>
			createPages(null, index + (direction === "after" ? 1 : 0)),
		cancel: () => {
			cancelRequested.current = true
		},
		run,
	}
}

export type PPTDeckTools = ReturnType<typeof usePPTDeckTools>
