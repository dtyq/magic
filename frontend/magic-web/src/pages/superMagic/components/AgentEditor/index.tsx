import {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react"
import { AgentEditorProps, AgentEditorRef } from "./types"
import { useStyles } from "./style"
import { useTranslation } from "react-i18next"
import { Spin } from "antd"
import { SuperMagicApi } from "@/apis"
import { resolveCrewAgentPromptText } from "@/services/crew/agent-prompt"
import type { AgentDetailResponse } from "@/apis/modules/crew"
import { LazySimpleEditor } from "@/components/tiptap-templates/simple/lazy-simple-editor"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/types"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"

const AgentEditor = forwardRef<AgentEditorRef, AgentEditorProps>((props, ref) => {
	const { agent, onChange, onReady, setEditorAgent, setLoading, loading } = props
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	// SimpleEditor ref
	const simpleEditorRef = useRef<SimpleEditorRef>(null)
	const [simpleEditorReady, setSimpleEditorReady] = useState(false)

	// 暴露给父组件的方法
	useImperativeHandle(ref, () => ({
		setData: async (data) => {
			if (!simpleEditorRef.current) {
				console.warn("SimpleEditor not initialized")
				return
			}

			const content = typeof data === "string" ? data : JSON.stringify(data)
			simpleEditorRef.current.setContent(content)
		},

		getData: async () => {
			const editor = simpleEditorRef.current?.editor
			if (!editor) {
				console.warn("SimpleEditor not initialized")
				return null
			}

			try {
				const storage = editor.storage as { markdown?: { getMarkdown: () => string } }
				const markdownOutput = storage.markdown?.getMarkdown() || ""
				return markdownOutput
			} catch (error) {
				console.error("Failed to get editor data:", error)
				return null
			}
		},

		clear: async () => {
			if (!simpleEditorRef.current) {
				console.warn("SimpleEditor not initialized")
				return
			}

			try {
				simpleEditorRef.current.setContent("")
				onChange?.("")
			} catch (error) {
				console.error("Failed to clear editor:", error)
				throw error
			}
		},

		focus: () => {
			runActiveEditor(simpleEditorRef.current?.editor, (editor) => {
				editor.commands.focus()
			})
		},
	}))

	// 处理编辑器初始化完成逻辑
	const handleEditorReady = useCallback(() => {
		onReady?.()
	}, [onReady])

	// 处理数据加载和编辑器初始化
	useEffect(() => {
		if (!simpleEditorReady || !simpleEditorRef.current) return

		if (agent.id) {
			SuperMagicApi.getAgentDetail({ agent_id: agent.id })
				.then((res: Pick<AgentDetailResponse, "prompt"> & { tools?: unknown }) => {
					const content = resolveCrewAgentPromptText(res.prompt)
					simpleEditorRef.current?.setContent(content)
					setEditorAgent?.((pre: Record<string, unknown>) => {
						return {
							...pre,
							tools: res?.tools,
						}
					})
					setLoading(false)
					// 数据加载完成，编辑器初始化完成
					handleEditorReady()
				})
				.catch((error) => {
					console.error("Failed to get agent detail:", error)
					setLoading(false)
				})
		} else {
			setLoading(false)
			// 没有 agent 数据，但编辑器仍然准备就绪
			handleEditorReady()
		}
	}, [agent.id, simpleEditorReady, setEditorAgent, setLoading, handleEditorReady])

	// 阻止所有按键事件冒泡
	const handleKeyDown = (event: React.KeyboardEvent) => {
		event.stopPropagation()
	}

	return (
		<div className={styles.container} onKeyDown={handleKeyDown} data-testid="handle-key-down">
			<Spin spinning={loading}>
				<div className={styles.editorWrapper}>
					<LazySimpleEditor
						ref={simpleEditorRef}
						onReady={() => setSimpleEditorReady(true)}
						content=""
						onUpdate={({ editor: _editor }) => {
							const markdown =
								(
									_editor.storage as { markdown?: { getMarkdown: () => string } }
								).markdown?.getMarkdown() || ""
							onChange?.(markdown)
						}}
						isEditable={!loading}
						enableDragHandle={true}
						placeholder={t("agentEditor.placeholder")}
					/>
				</div>
			</Spin>
		</div>
	)
})

export default memo(AgentEditor)
