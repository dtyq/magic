import { useEffect, useState } from "react"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useMessageListProjectFilesStore } from "@/pages/superMagic/components/MessageList/context"
import { useFileApi, type FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { useSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import { useOptionalPersonaResearchStore } from "../context"
import {
	attachmentVersionKey,
	getAttachmentPath,
	parsePersonaFile,
} from "../services/researchFiles"
import type { PersonaFile } from "../types"

// One index per immutable attachment snapshot: many avatars must not each scan 10k files.
const indexes = new WeakMap<AttachmentItem[], Map<string, AttachmentItem>>()
function indexOf(files: AttachmentItem[]) {
	let index = indexes.get(files)
	if (!index) {
		index = new Map(files.map((file) => [getAttachmentPath(file), file]))
		indexes.set(files, index)
	}
	return index
}

// Tool cards can precede portrait generation. Read the current persona, not the historical
// tool result, with bounded, access-scoped coalescing. Unmount cancels only the consumer.
const profiles = new Map<string, Promise<PersonaFile | undefined>>()
function readProfile(api: FileApi, fileId: string, key: string) {
	let pending = profiles.get(key)
	if (!pending) {
		pending = api
			.getFileContentById(fileId, { responseType: "text", forceRefresh: true })
			.then((text) => {
				const parsed = parsePersonaFile(typeof text === "string" ? JSON.parse(text) : null)
				if (!parsed.ok) throw new Error("Invalid persona profile")
				return parsed.data
			})
			.catch(() => {
				if (profiles.get(key) === pending) profiles.delete(key)
				return undefined
			})
		if (profiles.size >= 256) profiles.delete(profiles.keys().next().value as string)
		profiles.set(key, pending)
	}
	return pending
}

/** Shared file identity for research views, historical tool cards, and authorized shares. */
export function usePersonaPortrait(id: string) {
	const store = useOptionalPersonaResearchStore()
	const messageFiles = useMessageListProjectFilesStore()
	const api = useFileApi()
	const scope = useSharedMediaResourceScope()
	const files = store?.attachmentList ?? messageFiles.workspaceFilesList
	const index = indexOf(files)
	const local = store?.personaById(id)
	const file = index.get(`personas/${id}.json`)
	const fileId = file?.file_id ?? ""
	const accessKey = `${scope}:${api.identityKey}`
	const key = `${accessKey}:${id}:${file ? attachmentVersionKey(file) : ""}`
	const [loaded, setLoaded] = useState<{ key: string; persona?: PersonaFile }>()
	useEffect(() => {
		if (local || !fileId) return
		let cancelled = false
		const load = () => {
			void readProfile(api, fileId, key).then((persona) => {
				if (!cancelled)
					setLoaded({ key, persona: persona?.id === id ? persona : undefined })
			})
		}
		load()
		// Recover metadata even when no image mounted after a failed initial read.
		const unsubscribe = subscribePortraitRecovery(load)
		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [api, fileId, id, key, local])
	const persona = local ?? (loaded?.key === key ? loaded.persona : undefined)
	const portrait = persona?.portrait
	// Resolve only through this scene's authorized attachments. A hidden share image stays
	// on its fallback even if persona JSON mentions a file from elsewhere in the project.
	const image = portrait?.file.startsWith(`personas/portraits/${id}/`)
		? index.get(portrait.file)
		: undefined
	return { persona, image, accessKey }
}

const recoveryListeners = new Set<() => void>()
function recoverPortraits() {
	if (document.visibilityState === "visible") recoveryListeners.forEach((refresh) => refresh())
}

/** A single set of browser listeners serves all avatar instances. */
export function subscribePortraitRecovery(refresh: () => void) {
	if (recoveryListeners.size === 0) {
		document.addEventListener("visibilitychange", recoverPortraits)
		window.addEventListener("pageshow", recoverPortraits)
		window.addEventListener("online", recoverPortraits)
	}
	recoveryListeners.add(refresh)
	return () => {
		recoveryListeners.delete(refresh)
		if (recoveryListeners.size === 0) {
			document.removeEventListener("visibilitychange", recoverPortraits)
			window.removeEventListener("pageshow", recoverPortraits)
			window.removeEventListener("online", recoverPortraits)
		}
	}
}
