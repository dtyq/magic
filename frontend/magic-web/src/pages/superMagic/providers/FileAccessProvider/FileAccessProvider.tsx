import { useContext, useMemo, type PropsWithChildren } from "react"
import { FileAccessContext } from "./context"
import { useResolveFileAccess } from "./hooks/useResolveFileAccess"
import type { FileAccessConfig, FileAccessOverrides } from "./types"

type Props = PropsWithChildren<FileAccessConfig>
/** Only a business root resolves deployment policy. Nested scopes inherit it. */
export function FileAccessProvider(props: Props) {
	const { isScoped } = useContext(FileAccessContext)
	return isScoped ? (
		<ResolvedFileAccessProvider {...props} />
	) : (
		<RootFileAccessProvider {...props} />
	)
}
function RootFileAccessProvider(props: Props) {
	const policy = useResolveFileAccess()
	return <ResolvedFileAccessProvider {...props} policy={policy} />
}
function ResolvedFileAccessProvider({
	permissions,
	options,
	policy,
	children,
}: Props & { policy?: FileAccessOverrides }) {
	const inheritedAccess = useContext(FileAccessContext)
	// Permission denials accumulate; presentation choices permit explicit local overrides.
	const download =
		inheritedAccess.permissions.download &&
		policy?.download !== false &&
		permissions?.download !== false
	const preview =
		inheritedAccess.permissions.preview &&
		policy?.preview !== false &&
		permissions?.preview !== false
	const share =
		inheritedAccess.permissions.share && policy?.share !== false && permissions?.share !== false
	const view =
		inheritedAccess.permissions.view && policy?.view !== false && permissions?.view !== false
	const canExport =
		inheritedAccess.permissions.export &&
		policy?.export !== false &&
		permissions?.export !== false
	const copyTo = options?.copyTo ?? inheritedAccess.options.copyTo
	const moveTo = options?.moveTo ?? inheritedAccess.options.moveTo
	const shareTopic = options?.shareTopic ?? inheritedAccess.options.shareTopic
	const createNewTopic = options?.createNewTopic ?? inheritedAccess.options.createNewTopic
	const fullscreen = options?.fullscreen ?? inheritedAccess.options.fullscreen
	const versionHistory = options?.versionHistory ?? inheritedAccess.options.versionHistory
	const shareInReadOnly = options?.shareInReadOnly ?? inheritedAccess.options.shareInReadOnly
	const resolvedPermissions = useMemo(
		() => ({ download, preview, share, view, export: canExport }),
		[download, preview, share, view, canExport],
	)
	const resolvedOptions = useMemo(
		() => ({
			copyTo,
			moveTo,
			shareTopic,
			createNewTopic,
			fullscreen,
			versionHistory,
			shareInReadOnly,
		}),
		[copyTo, moveTo, shareTopic, createNewTopic, fullscreen, versionHistory, shareInReadOnly],
	)
	// Stable primitive-derived objects avoid notifying file rows on unrelated page renders.
	const context = useMemo(
		() => ({ permissions: resolvedPermissions, options: resolvedOptions, isScoped: true }),
		[resolvedPermissions, resolvedOptions],
	)
	return <FileAccessContext.Provider value={context}>{children}</FileAccessContext.Provider>
}
