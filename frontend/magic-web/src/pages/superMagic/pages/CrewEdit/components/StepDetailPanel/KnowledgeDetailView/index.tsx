import { observer } from "mobx-react-lite"
import { useEffect, useRef } from "react"
import { useCrewEditStore } from "../../../context"
import { useKnowledgeDetailMode, useKnowledgeNavigation, useKnowledgeSelection } from "./hooks"
import { CreateModeView } from "./components/CreateModeView"
import { BrowseModeView } from "./components/BrowseModeView"
import { RecallTestView } from "./components/RecallTestView"
import { RebindModeView } from "./components/RebindModeView"
import type { KnowledgeDetailViewProps } from "./types"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

/**
 * Main container component for knowledge detail view
 * Handles routing between create mode and browse mode
 * Uses custom hooks for state management and navigation
 *
 * Refactored following Vercel React Best Practices:
 * - 5.1: Calculate derived state during rendering
 * - 5.5: Extract to memoized components
 * - 7.8: Early return from functions
 */
function KnowledgeDetailView({ knowledgeCode }: KnowledgeDetailViewProps) {
	const { crewCode, knowledge } = useCrewEditStore()

	// 使用 ref 存储最新的 knowledge，避免因 MobX 对象引用变化导致重复订阅
	const knowledgeRef = useRef(knowledge)
	useEffect(() => {
		knowledgeRef.current = knowledge
	}, [knowledge])

	// 订阅文档列表轮询事件（从重新绑定等操作触发）
	// 在 KnowledgeDetailView 层级订阅，确保整个知识库详情视图只有一个订阅实例
	// 这个组件在 rebind/create/browse 模式切换时都保持挂载，所以可以接收到事件
	useEffect(() => {
		console.log(
			`[KnowledgeDetailView] 订阅 Trigger_Document_List_Polling 事件, knowledgeCode: ${knowledgeCode}`,
		)
		pubsub.subscribe(PubSubEvents.Trigger_Document_List_Polling, () => {
			console.log("[KnowledgeDetailView] 收到文档列表轮询事件，刷新文档列表")
			if (knowledgeCode) {
				// 刷新文档列表（非静默模式，显示 loading）
				void knowledgeRef.current.fetchDocumentList(knowledgeCode)
			}
		})
		return () => {
			console.log(
				`[KnowledgeDetailView] 取消订阅 Trigger_Document_List_Polling 事件, knowledgeCode: ${knowledgeCode}`,
			)
			pubsub.unsubscribe(PubSubEvents.Trigger_Document_List_Polling)
		}
	}, [knowledgeCode])

	// Custom hooks for business logic
	const {
		isCreateMode,
		isEditMode,
		isRecallTestMode,
		isRebindMode,
		documentType,
		editDocumentCode,
	} = useKnowledgeDetailMode()
	const { handleClose, handleBackToList } = useKnowledgeNavigation({
		crewCode: crewCode ?? undefined,
		knowledgeCode,
	})
	const { currentKnowledge, showDocumentSplit } = useKnowledgeSelection({
		knowledgeCode,
	})

	// Early return for recall test mode (Vercel 7.8)
	if (isRecallTestMode) {
		return (
			<div className="flex h-full w-full flex-col bg-background p-3.5">
				<RecallTestView knowledgeCode={knowledgeCode} onClose={handleBackToList} />
			</div>
		)
	}

	// Early return for rebind mode (Vercel 7.8)
	if (isRebindMode) {
		return (
			<div className="flex h-full w-full flex-col bg-background p-3.5">
				<RebindModeView
					knowledgeCode={knowledgeCode}
					knowledgeName={currentKnowledge?.name}
					onComplete={() => handleBackToList(true)} // skipRefresh=true，由轮询自动刷新
					onCancel={handleBackToList}
				/>
			</div>
		)
	}

	// Early return for create/edit mode (Vercel 7.8)
	if ((isCreateMode || isEditMode) && documentType) {
		return (
			<div className="flex h-full w-full flex-col bg-background p-3.5">
				<CreateModeView
					knowledgeCode={knowledgeCode}
					documentType={documentType}
					knowledgeName={currentKnowledge?.name}
					editMode={isEditMode}
					editDocumentCode={editDocumentCode}
					onComplete={handleBackToList}
					onCancel={handleBackToList}
				/>
			</div>
		)
	}

	// Browse mode
	return (
		<div className="flex h-full w-full flex-col bg-background p-3.5">
			<BrowseModeView
				currentKnowledge={currentKnowledge}
				showDocumentSplit={showDocumentSplit}
				onClose={handleClose}
				knowledgeCode={knowledgeCode}
			/>
		</div>
	)
}

export default observer(KnowledgeDetailView)
