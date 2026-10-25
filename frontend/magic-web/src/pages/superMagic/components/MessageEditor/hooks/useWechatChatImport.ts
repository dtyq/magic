import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/core"
import { NodeSelection } from "@/infrastructure/editors/tiptap/pm-state"
import { isInternationalEnv, isPrivateDeployment } from "@/utils/env"
import { findWechatChat } from "../extensions/wechat-chat-history/commands"
import { WECHAT_CHAT_HISTORY } from "../extensions/wechat-chat-history/types"
import {
	createWechatChat,
	serializeWechatInstruction,
} from "../extensions/wechat-chat-history/transform"
import { isWechatInstruction, parseWechatChat } from "../extensions/wechat-chat-history/parser"
import { installWechatSlashCommand, type SlashMenuState } from "../extensions/slash-command"
import { useIsMobile } from "@/hooks/useIsMobile"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"

export function useWechatChatImport(editor: Editor | null, enabled: boolean, sessionId: string) {
	const { t } = useTranslation("super")
	const mobile = useIsMobile()
	const available = enabled && !isInternationalEnv() && !isPrivateDeployment()
	const [activeId, setActiveId] = useState<string | null>(null)
	const activeRef = useRef(activeId)
	activeRef.current = activeId
	const [menu, setMenu] = useState<SlashMenuState | null>(null)
	const [revision, setRevision] = useState(0)
	const [scrollRequest, setScrollRequest] = useState(0)
	const slash = useRef<ReturnType<typeof installWechatSlashCommand> | null>(null)
	const preview = useMemoizedFn((id: string, focusInstruction = true) => {
		if (!available || !editor) return
		const location = findWechatChat(editor, id)
		if (!location) return
		AiCompletionService.disable()
		activeRef.current = id
		setActiveId(id)
		setScrollRequest((value) => value + 1)
		const last = location.node.lastChild
		if (last && isWechatInstruction(last.toJSON())) {
			const start = location.position + location.node.nodeSize - last.nodeSize - 1
			let placeholderPosition: number | null = null
			last.forEach((node, offset) => {
				if (node.type.name === "super-placeholder") placeholderPosition = start + 1 + offset
			})
			if (focusInstruction && !mobile && placeholderPosition !== null)
				editor.commands.setNodeSelection(placeholderPosition)
			else editor.commands.setTextSelection(start - 1)
		}
	})
	const openImport = useMemoizedFn(() => {
		if (!editor || !available || !editor.isEditable) return
		const block = createWechatChat(
			[{ type: "paragraph" }],
			t("wechatChat.instructionPlaceholder"),
		)
		const selection = editor.state.selection
		let afterChat: number | undefined =
			selection instanceof NodeSelection && selection.node.type.name === WECHAT_CHAT_HISTORY
				? selection.to
				: undefined
		for (let depth = selection.$from.depth; depth > 0; depth--) {
			if (selection.$from.node(depth).type.name !== WECHAT_CHAT_HISTORY) continue
			afterChat = selection.$from.after(depth)
			break
		}
		// 工具栏可以在区块内点击；新导入放在当前区块后，不覆盖聊天或局部要求。
		const content: JSONContent[] = [block, { type: "paragraph" }]
		const inserted =
			afterChat === undefined
				? editor.commands.insertContent(content)
				: editor.commands.insertContentAt(afterChat, content)
		if (!inserted) return
		const id = block.attrs?.id as string
		const location = findWechatChat(editor, id)
		if (location) editor.commands.setTextSelection(location.position + 2)
		preview(id, false)
	})
	const close = useMemoizedFn(() => {
		const id = activeRef.current
		activeRef.current = null
		setActiveId(null)
		if (!editor || !id) return
		const location = findWechatChat(editor, id)
		if (location && !parseWechatChat(location.node.toJSON().content ?? []).messages.length) {
			// 空导入关闭时保留用户输入；只移除该空区块及空引导，不撤销原附件上传。
			const source: JSONContent[] = location.node.toJSON().content ?? []
			const hasInstruction = isWechatInstruction(source.at(-1) ?? {})
			const ordinary = (hasInstruction ? source.slice(0, -1) : source).filter(
				(node) => node.content?.length,
			)
			if (hasInstruction) {
				const instruction = serializeWechatInstruction(source[source.length - 1])
				if (instruction.content?.length)
					ordinary.push({ type: "paragraph", content: instruction.content })
			}
			editor.commands.insertContentAt(
				{ from: location.position, to: location.position + location.node.nodeSize },
				ordinary,
			)
		} else if (location) {
			// 收起后光标移到区块外；不能继续在隐藏的聊天原文里输入普通要求。
			const after = location.position + location.node.nodeSize
			if (editor.state.doc.nodeAt(after)?.type.name !== "paragraph")
				editor.commands.insertContentAt(after, { type: "paragraph" })
			editor.commands.setTextSelection(after + 1)
		}
	})
	const append = useMemoizedFn((id: string) => {
		if (!editor) return
		preview(id)
		const location = findWechatChat(editor, id)
		if (!location) return
		const instructionSize =
			location.node.lastChild && isWechatInstruction(location.node.lastChild.toJSON())
				? location.node.lastChild.nodeSize
				: 0
		editor.commands.setTextSelection(
			location.position + location.node.nodeSize - instructionSize - 2,
		)
		editor.commands.focus()
	})
	const onImported = useMemoizedFn((id: string) => preview(id))
	const handleKeyDown = useMemoizedFn(
		(event: KeyboardEvent) => slash.current?.handleKeyDown(event) ?? false,
	)
	const isOpen = useMemoizedFn(() => activeRef.current !== null)
	const openCommandMenu = useMemoizedFn((anchor: HTMLElement) => {
		if (!available || !editor?.isEditable || activeRef.current) return
		AiCompletionService.disable()
		slash.current?.open(anchor)
	})
	useEffect(() => {
		if (!editor || !available) return
		const controller = installWechatSlashCommand(editor, setMenu, openImport)
		slash.current = controller
		return () => {
			slash.current = null
			controller.dispose()
		}
	}, [editor, available, openImport])
	useEffect(() => {
		if (!editor) return
		let frame: number | null = null
		const update = () => {
			if (frame !== null) return
			frame = requestAnimationFrame(() => {
				frame = null
				setRevision((value) => value + 1)
				if (activeRef.current && !findWechatChat(editor, activeRef.current)) {
					activeRef.current = null
					setActiveId(null)
				}
			})
		}
		editor.on("update", update)
		return () => {
			editor.off("update", update)
			if (frame !== null) cancelAnimationFrame(frame)
		}
	}, [editor])
	useEffect(() => {
		slash.current?.dismiss()
		activeRef.current = null
		setActiveId(null)
		setMenu(null)
	}, [sessionId, available])
	return {
		available,
		activeId,
		menu,
		revision,
		scrollRequest,
		preview,
		append,
		close,
		openImport,
		onImported,
		handleKeyDown,
		isOpen,
		openCommandMenu,
		dismissMenu: (restoreFocus = false) => slash.current?.dismiss(restoreFocus),
	}
}

export type WechatChatImportController = ReturnType<typeof useWechatChatImport>
