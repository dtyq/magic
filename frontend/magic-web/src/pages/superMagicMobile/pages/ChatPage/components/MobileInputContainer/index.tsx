import MagicPopup from "@/components/base-mobile/MagicPopup"
import BottomInputBar from "../BottomInputBar"
import { useMemoizedFn } from "ahooks"
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react"
import MobileInputLayout from "../MobileInputLayout"
import {
	SceneEditorContext,
	SceneEditorNodes,
} from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import type { JSONContent } from "@tiptap/core"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/types"

/** 弹窗打开时不触发编辑器自动聚焦和虚拟键盘唤起的 TopicMode 集合 */
const MODES_WITHOUT_AUTO_FOCUS = new Set<TopicMode>([TopicMode.RecordSummary])

export interface MobileInputContainerRef {
	closeRealInput: () => void
}

interface MobileInputContainerProps {
	editorContext: SceneEditorContext
	editorNodes?: SceneEditorNodes
}

const MobileInputContainer = forwardRef<MobileInputContainerRef, MobileInputContainerProps>(
	function MobileInputContainer({ editorContext, editorNodes }, ref) {
		const [showRealInput, setShowRealInput] = useState(false)
		const [isRealInputFocused, setIsRealInputFocused] = useState(false)
		const [pendingContent, setPendingContent] = useState<JSONContent | null>(null)
		/** 弹窗编辑器的实时内容，弹窗关闭后同步回底部输入栏 */
		const [sharedContent, setSharedContent] = useState<JSONContent | null>(null)

		/**
		 * iOS Safari 限制：programmatic focus() 必须在用户手势的同步调用链内触发。
		 * 通过屏幕外代理 <input> 实现：用户点击时立即 focus 代理输入框（唤起键盘），
		 * 再由 DefaultMessageEditorContainer 在 setTimeout 内将焦点转移到编辑器。
		 * 因为键盘此时已可见，焦点转移无需重新持有用户手势上下文即可成功。
		 */
		const proxyInputRef = useRef<HTMLInputElement>(null)

		const shouldAutoFocus = !MODES_WITHOUT_AUTO_FOCUS.has(editorContext.topicMode)

		const handleOpenRealInput = useMemoizedFn((content: JSONContent | null) => {
			if (shouldAutoFocus) proxyInputRef.current?.focus()
			setPendingContent(content)
			setShowRealInput(true)
		})

		const handleContentChange = useMemoizedFn((content: JSONContent) => {
			setSharedContent(content)
		})

		type SendSuccessParams = Parameters<NonNullable<SceneEditorContext["onSendSuccess"]>>[0]
		const handleSendSuccess = useMemoizedFn((params: SendSuccessParams) => {
			// 发送成功后立即关闭弹窗，无需依赖父组件在 onSendSuccess 中手动调用 closeRealInput
			closeRealInput()
			editorContext.onSendSuccess?.(params)
		})

		const handleEditorFocus = useMemoizedFn(() => {
			setIsRealInputFocused(true)
		})

		const handleEditorBlur = useMemoizedFn(() => {
			setIsRealInputFocused(false)
		})

		const closeRealInput = useMemoizedFn(() => {
			setShowRealInput(false)
			setIsRealInputFocused(false)
			setPendingContent(null)
		})

		useImperativeHandle(ref, () => ({ closeRealInput }), [closeRealInput])

		/** 注入 autoFocus、语音输入初始内容、内容变更回调，避免污染上层传入的 editorContext */
		const mobileEditorContext = useMemo<SceneEditorContext>(
			() => ({
				...editorContext,
				autoFocus: shouldAutoFocus,
				size: "mobile",
				initialContent: pendingContent ?? undefined,
				onContentChange: handleContentChange,
				onEditorFocus: handleEditorFocus,
				onEditorBlur: handleEditorBlur,
				onSendSuccess: handleSendSuccess,
			}),
			// pendingContent 每次打开弹窗时只需初始化一次，editorContext 变化时同步更新
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[editorContext, pendingContent],
		)

		return (
			<>
				{/* iOS 键盘代理：立即获焦以在用户手势上下文内唤起键盘，随后焦点转移至编辑器 */}
				<input
					ref={proxyInputRef}
					aria-hidden="true"
					tabIndex={-1}
					className="pointer-events-none absolute opacity-0"
					style={{ top: -9999, left: -9999, width: 1, height: 1 }}
				/>

				{/* 底部输入栏（没有实际的输入功能，仅用于选择角色和唤起真正的输入框） */}
				<BottomInputBar
					show={!showRealInput}
					onInputClick={handleOpenRealInput}
					syncContent={sharedContent}
					editorNodes={editorNodes}
					isTaskRunning={
						editorContext.isTaskRunning ?? editorContext.showLoading ?? false
					}
					stopEventLoading={editorContext.stopEventLoading ?? false}
					onInterrupt={editorContext.handleInterrupt}
				/>

				{/* 真正的输入框 */}
				<MagicPopup
					overlayClassName="backdrop-blur-sm ![animation-name:none]"
					visible={showRealInput}
					onClose={closeRealInput}
					handlerClassName="!hidden"
					withSafeBottom={!isRealInputFocused}
				>
					<MobileInputLayout editorContext={mobileEditorContext} />
				</MagicPopup>
			</>
		)
	},
)

export default MobileInputContainer
