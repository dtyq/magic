import type {
	CanvasResourceReferenceResolution,
	ResolveCanvasResourceReference,
} from "../resource-reference"

/** Minimal strict resolver shared by CanvasDesign contract tests. */
export function createTestResourceReferenceResolver(options?: {
	currentCanvasWorkspacePath?: string
	attachmentPathsByFileId?: Record<string, string>
	attachmentsReady?: boolean
}): ResolveCanvasResourceReference {
	const currentCanvasWorkspacePath = options?.currentCanvasWorkspacePath ?? "/画布A"
	const currentCanvasPrefix = `${currentCanvasWorkspacePath.replace(/\/+$/, "")}/`
	const attachmentEntries = Object.entries(options?.attachmentPathsByFileId ?? {})
	const toWorkspacePath = (path: string) => {
		const normalized = path.replace(/\\/g, "/")
		if (normalized.startsWith("./")) {
			return `${currentCanvasPrefix}${normalized.replace(/^\.\/+/, "")}`
		}
		return normalized.startsWith("/") ? normalized : `/${normalized}`
	}

	return (input, resolveOptions): CanvasResourceReferenceResolution => {
		if (input.namespace === "external-url") {
			const url = input.url.trim()
			return {
				status: "resolved",
				resourceKind: "external",
				rawReference: url,
				storagePath: url,
				identity: `external:${url}`,
				candidates: [],
				legacyRecovered: false,
				resolutionSource: "external",
			}
		}
		if (input.namespace === "private-upload-path") {
			const rawReference = input.path.trim()
			const privatePath = rawReference
				.replace(/\\/g, "/")
				.replace(/^\.\//, "")
				.replace(/^\/+|\/+$/g, "")
			if (!privatePath || privatePath.split("/").some((segment) => segment === "..")) {
				return {
					status: "invalid",
					rawReference,
					candidates: [],
					reason: privatePath ? "path-traversal" : "missing-private-upload-path",
				}
			}
			return {
				status: "resolved",
				resourceKind: "private-upload",
				rawReference,
				storagePath: privatePath,
				identity: `private-upload:${privatePath}`,
				candidates: [privatePath],
				legacyRecovered: false,
				resolutionSource: "private-upload-path",
			}
		}

		const attachmentPath =
			input.namespace === "attachment"
				? options?.attachmentPathsByFileId?.[input.fileId]
				: undefined
		if (input.namespace === "attachment" && !attachmentPath) {
			return {
				status: options?.attachmentsReady === false ? "attachments-pending" : "not-found",
				rawReference: input.fileId,
				candidates: [],
				attachmentIds: [input.fileId],
			}
		}

		const rawReference = input.namespace === "attachment" ? input.fileId : input.path.trim()
		let path = input.namespace === "attachment" ? attachmentPath || "" : rawReference
		let attachmentId = input.namespace === "attachment" ? input.fileId : undefined
		let legacyRecovered = false
		const normalized = path.replace(/\\/g, "/")
		if (!normalized) {
			return {
				status: "invalid",
				rawReference,
				candidates: [],
				reason: "empty-reference",
			}
		}
		const isLegacyBareResource =
			input.namespace === "canvas-storage" &&
			!/^(?:\.\/|\/)/.test(normalized) &&
			/^(?:images|videos|audios)\//.test(normalized)
		if (isLegacyBareResource && input.mode !== "legacy-recovery") {
			return {
				status: "invalid",
				rawReference,
				candidates: [],
				reason: "legacy-path-requires-recovery",
			}
		}

		if (
			input.namespace === "canvas-storage" &&
			input.mode === "legacy-recovery" &&
			!normalized.startsWith("./") &&
			!normalized.startsWith("/")
		) {
			const candidates = [`${currentCanvasPrefix}${normalized}`, `/${normalized}`]
			const matches = attachmentEntries.filter(([, candidatePath]) =>
				candidates.includes(toWorkspacePath(candidatePath)),
			)
			if (matches.length !== 1) {
				return {
					status:
						matches.length > 1
							? "ambiguous"
							: options?.attachmentsReady === false
								? "attachments-pending"
								: "not-found",
					rawReference,
					candidates,
					attachmentIds: matches.map(([fileId]) => fileId),
				}
			}
			attachmentId = matches[0][0]
			path = matches[0][1]
			legacyRecovered = true
		}

		const normalizedPath = path.replace(/\\/g, "/")
		const workspacePath = normalizedPath.startsWith("./")
			? `${currentCanvasPrefix}${normalizedPath.replace(/^\.\/+/, "")}`
			: toWorkspacePath(normalizedPath)
		const exactAttachmentMatches = attachmentEntries.filter(
			([, candidatePath]) => toWorkspacePath(candidatePath) === workspacePath,
		)
		if (!attachmentId && exactAttachmentMatches.length > 1) {
			return {
				status: "ambiguous",
				rawReference,
				candidates: [workspacePath],
				attachmentIds: exactAttachmentMatches.map(([fileId]) => fileId),
			}
		}
		attachmentId ??= exactAttachmentMatches[0]?.[0]
		if (resolveOptions?.requireAttachment && !attachmentId) {
			return {
				status: options?.attachmentsReady === false ? "attachments-pending" : "not-found",
				rawReference,
				candidates: [workspacePath],
			}
		}
		const storagePath = workspacePath.startsWith(currentCanvasPrefix)
			? `./${workspacePath.slice(currentCanvasPrefix.length)}`
			: workspacePath

		return {
			status: "resolved",
			resourceKind: "workspace-file",
			rawReference,
			workspacePath,
			storagePath,
			identity: `workspace:${workspacePath}`,
			attachmentId,
			source: input.namespace === "attachment" ? input.source : undefined,
			candidates: [workspacePath],
			legacyRecovered,
			resolutionSource:
				input.namespace === "workspace-path"
					? "workspace-path"
					: input.namespace === "attachment"
						? "attachment-id"
						: legacyRecovered
							? "legacy-recovery"
							: "strict-path",
		}
	}
}
