import VoiceInput, { VoiceInputRef } from "@/opensource/components/business/VoiceInput"
import { VoiceResultUtterance } from "@/opensource/components/business/VoiceInput/services/VoiceClient/types"
import { VoiceResult } from "@/opensource/components/business/VoiceInput/types"
import AiCompletionService from "@/opensource/services/chat/editor/AiCompletionService"
import { isMobile } from "@/opensource/utils/devices"
import { ChainedCommands, Editor, JSONContent } from "@tiptap/core"
import { logger as Logger } from "@/opensource/utils/log"
import { useMemoizedFn } from "ahooks"
import { forwardRef, Ref, useRef, useImperativeHandle, useEffect } from "react"

interface SuperMagicVoiceInputProps {
	className?: string
	initValue?: JSONContent | string | null
	tiptapEditor?: Editor | null
	updateValue?: (value: JSONContent) => void
	iconSize?: number
}

const logger = Logger.createLogger("SuperMagicVoiceInput")

/**
 * Realtime voice input configuration - optimized for ultra-low latency
 * 实时语音输入配置 - 针对极致实时性优化
 */
const config = {
	request: {
		resultType: "single" as const, // Incremental results for faster response
		endWindowSize: 300, // 300ms silence detection for quick sentence breaks
		forceToSpeechTime: 1000, // Allow quick definite after 1 second
		enableAccelerateText: true, // Enable first-word acceleration
		accelerateScore: 18, // Max acceleration (range 0-20) for fastest first-word
		enableNonstream: false, // Disable dual-pass for lower latency
		enableDdc: true, // Disable semantic smoothing for faster processing
	},
}

const SuperMagicVoiceInput = forwardRef<VoiceInputRef, SuperMagicVoiceInputProps>(
	(
		{
			initValue,
			tiptapEditor,
			updateValue,
			iconSize = 20,
			className,
		}: SuperMagicVoiceInputProps,
		ref: Ref<VoiceInputRef>,
	) => {
		const voiceInputRef = useRef<VoiceInputRef>(null)
		const enableScrollIntoViewRef = useRef(true)
		const isProgrammaticScrollRef = useRef(false)
		const lastTextSelectionRef = useRef<number | null>(null)

		const shouldIgnoreNonDefiniteRef = useRef<boolean>(false)
		const lastDefinitePositionRef = useRef<{
			start: number
			end: number
			length: number
		} | null>(null)

		const handleResult = useMemoizedFn((result: string, response: VoiceResult) => {
			// Early return: abnormal data check
			if (result.startsWith('sult":{"additions')) {
				logger.error("Abnormal data received", response)
				return
			}

			console.log("handleResult", result, response)

			// Early return: only process when recording and editor is available
			if (!voiceInputRef.current?.isRecording || !tiptapEditor) {
				return
			}

			try {
				const chain = tiptapEditor.chain()

				if (!isMobile && !tiptapEditor.isFocused) {
					chain.focus()
				}

				// Process each utterance segment incrementally
				processUtterances(response.utterances, chain, tiptapEditor)

				// Auto-scroll if enabled
				if (enableScrollIntoViewRef.current) {
					isProgrammaticScrollRef.current = true
					chain.scrollIntoView()
				}

				// Execute all commands in batch
				chain.run()

				// Update value after DOM updates
				requestAnimationFrame(() => {
					if (tiptapEditor.isDestroyed) return
					const newContent = tiptapEditor.getJSON()
					updateValue?.(newContent)
				})
			} catch (error) {
				logger.error("Voice input processing failed", error)
			}
		})

		// Helper: process utterances and update editor incrementally
		function processUtterances(
			utterances: VoiceResultUtterance[] | undefined,
			chain: ChainedCommands,
			editor: Editor,
		) {
			if (!utterances) {
				return
			}
			for (const utterance of utterances) {
				if (utterance.start_time === -1 || utterance.end_time === -1) {
					continue
				}

				const isDefinite = utterance.definite

				const currentCursor = editor.state.selection.head
				// 如果当前光标位置与上次光标位置不同，需要判断是否需要跳过
				if (currentCursor !== lastTextSelectionRef.current) {
					// 如果上一句是判停的（lastDefinitePositionRef 为 null），说明上一句已经确定
					// 此时即使光标位置改变，也不应该忽略接下来的句子
					if (lastDefinitePositionRef.current === null) {
						console.log("上一句已判停，光标位置改变，更新光标位置并继续处理")
						lastTextSelectionRef.current = currentCursor
						shouldIgnoreNonDefiniteRef.current = false
						// 继续处理当前句子，不跳过
					} else {
						// 上一句是非确定性的，光标位置改变时需要跳过
						console.log("当前光标位置与上次光标位置不同，跳过该句")
						// 标记跳过
						if (!shouldIgnoreNonDefiniteRef.current) {
							console.log("标记下次应该跳过非确定性话语")
							shouldIgnoreNonDefiniteRef.current = true
						}

						// 如果当前句已经是确定了，移除标记
						if (isDefinite) {
							console.log("当前句已经是确定了，移除标记,更新光标位置")
							shouldIgnoreNonDefiniteRef.current = false
							lastTextSelectionRef.current = currentCursor
							// 清除确定性话语的位置跟踪
							lastDefinitePositionRef.current = null
						}

						console.log("该句不确定，跳过该句，保留标记")
						// 该句不确定，跳过该句，保留标记
						continue
					}
				}

				// 如果上次有未确定性话语，则删除
				if (lastDefinitePositionRef.current) {
					const { start, end } = lastDefinitePositionRef.current
					chain.deleteRange({ from: start, to: end })
					console.log("删除之前未确定性话语，从", start, "到", end)
				}

				// 计算插入位置
				const startPosition = lastDefinitePositionRef.current
					? lastDefinitePositionRef.current.start
					: editor.state.selection.head
				const endPosition = startPosition + utterance.text.length

				// 插入当前话语
				chain.insertContentAt(startPosition, utterance.text)
				console.log("插入当前话语", startPosition, utterance.text)

				// 更新位置跟踪
				if (isDefinite) {
					// 清除确定性话语的位置跟踪
					lastDefinitePositionRef.current = null
				} else {
					// 跟踪非确定性话语的位置
					lastDefinitePositionRef.current = {
						start: startPosition,
						end: endPosition,
						length: utterance.text.length,
					}
				}

				// Update cursor position
				chain.setTextSelection(endPosition)
				lastTextSelectionRef.current = endPosition

				chain.run()
			}
		}

		const handleRecordingChange = useMemoizedFn((isRecording: boolean) => {
			/**
			 * 录音时禁用AI自动补全
			 * 录音时禁用AI自动补全，避免AI自动补全与语音识别结果冲突
			 */
			if (isRecording) {
				AiCompletionService.disable()
			} else {
				AiCompletionService.enable()
			}

			if (isRecording && tiptapEditor) {
				enableScrollIntoViewRef.current = true
				shouldIgnoreNonDefiniteRef.current = false
				lastTextSelectionRef.current = null

				// Calculate and save base insertion position
				const currentSelection = tiptapEditor.state.selection
				const endPosition = tiptapEditor.state.doc.content.size - 1
				const startPos = currentSelection.head > 1 ? currentSelection.head : endPosition
				lastTextSelectionRef.current = startPos

				console.log("初始化光标位置", startPos)

				if (!tiptapEditor.isFocused && !isMobile) {
					console.log("初始化光标位置，聚焦编辑器")
					tiptapEditor.commands.focus()
				}
			} else if (!isRecording && tiptapEditor && !isMobile) {
				// Fix cursor position at recording end
				requestAnimationFrame(() => {
					if (tiptapEditor.isDestroyed) return
					if (lastTextSelectionRef.current !== null) {
						tiptapEditor.commands.setTextSelection(lastTextSelectionRef.current)
						lastTextSelectionRef.current = null
					}
				})
			}
		})

		// Monitor scroll events to manage auto-scroll behavior
		useEffect(() => {
			if (!tiptapEditor || tiptapEditor.isDestroyed) return

			const scrollElement = tiptapEditor?.view.dom.parentElement

			const handleScroll = (event: Event) => {
				console.log("scroll", {
					isProgrammatic: isProgrammaticScrollRef.current,
					isTrusted: event.isTrusted,
				})

				// If programmatic scroll, reset flag after completion
				if (isProgrammaticScrollRef.current) {
					setTimeout(() => {
						isProgrammaticScrollRef.current = false
					}, 50)
					return
				}

				// Disable auto-scroll only when user manually scrolls
				if (event.isTrusted) {
					enableScrollIntoViewRef.current = false
				}

				// Re-enable auto-scroll when scrolled to bottom
				if (
					scrollElement &&
					scrollElement.scrollTop + scrollElement.clientHeight >=
						scrollElement.scrollHeight
				) {
					enableScrollIntoViewRef.current = true
				}
			}

			if (scrollElement) {
				scrollElement.addEventListener("scroll", handleScroll)
			}

			return () => {
				if (scrollElement) {
					scrollElement.removeEventListener("scroll", handleScroll)
				}
			}
		}, [tiptapEditor])

		// Expose VoiceInput interface without additional state management
		useImperativeHandle(
			ref,
			() => ({
				stopRecording: () => voiceInputRef.current?.stopRecording(),
				isRecording: voiceInputRef.current?.isRecording ?? false,
				status: voiceInputRef.current?.status ?? "idle",
			}),
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[voiceInputRef.current],
		)

		return (
			<VoiceInput
				ref={voiceInputRef}
				onResult={handleResult}
				onRecordingChange={handleRecordingChange}
				iconSize={iconSize}
				className={className}
				enableHotkey={!isMobile}
				config={config}
			/>
		)
	},
)

export default SuperMagicVoiceInput
