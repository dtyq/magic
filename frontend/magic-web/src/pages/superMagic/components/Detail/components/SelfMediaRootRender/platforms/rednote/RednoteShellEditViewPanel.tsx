import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"
import { useSelfMediaStore } from "../../stores"
import RednoteEditView from "./edit"
import { RednoteShellContentGate } from "./RednoteShellContentGate"
import type { SelfMediaAttachmentNode, SelfMediaView } from "../../types"

export interface RednoteShellEditViewPanelProps {
	shouldRender: boolean
	isActive: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	saveEditContent?: (
		content: unknown,
		fileId?: string,
		enable_shadow?: boolean,
		fetchFileVersions?: (fileId: string) => void,
		isPPTEditMode?: boolean,
	) => Promise<void>
	selectedProject?: unknown
	onEditingStateChange: (editing: boolean) => void
	onRequestViewChangeReady?: (handler: ((nextView: SelfMediaView) => void) | null) => void
	onRequestPostChangeReady?: (handler: ((nextPostIndex: number) => void) | null) => void
	onAddCardToCurrentChat?: (index: number) => void
	onAddCardToNewChat?: (index: number) => void
	onShellDataReload?: () => void
	onRequestShellDataReloadReady?: (handler: (() => void) | null) => void
}

export const RednoteShellEditViewPanel = observer(function RednoteShellEditViewPanel(
	props: RednoteShellEditViewPanelProps,
) {
	const {
		shouldRender,
		isActive,
		attachmentList,
		saveEditContent,
		selectedProject,
		onEditingStateChange,
		onRequestViewChangeReady,
		onRequestPostChangeReady,
		onAddCardToCurrentChat,
		onAddCardToNewChat,
		onShellDataReload,
		onRequestShellDataReloadReady,
	} = props
	const store = useSelfMediaStore()
	const { loading, error, activePost } = store

	if (!shouldRender) return null

	return (
		<div
			className={cn("absolute inset-0", isActive ? "block" : "hidden")}
			aria-hidden={!isActive}
		>
			<RednoteShellContentGate loading={loading} error={error} hasPost={Boolean(activePost)}>
				{activePost ? (
					<RednoteEditView
						attachmentList={attachmentList}
						saveEditContent={saveEditContent}
						selectedProject={selectedProject}
						onEditingStateChange={onEditingStateChange}
						onRequestViewChangeReady={onRequestViewChangeReady}
						onRequestPostChangeReady={onRequestPostChangeReady}
						onAddCardToCurrentChat={onAddCardToCurrentChat}
						onAddCardToNewChat={onAddCardToNewChat}
						onShellDataReload={onShellDataReload}
						onRequestShellDataReloadReady={onRequestShellDataReloadReady}
					/>
				) : null}
			</RednoteShellContentGate>
		</div>
	)
})
