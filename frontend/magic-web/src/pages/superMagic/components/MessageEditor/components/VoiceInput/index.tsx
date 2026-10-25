import VoiceInput, { VoiceInputRef, type VoiceInputStatus } from "@/components/business/VoiceInput"
import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { VoiceResult } from "@/components/business/VoiceInput/types"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import { isMobile } from "@/utils/devices"
import { Editor, JSONContent } from "@/infrastructure/editors/tiptap/core"
import { logger as Logger } from "@/infrastructure/logger"
import { useMemoizedFn } from "ahooks"
import { forwardRef, Ref, useRef, useImperativeHandle, useEffect, type ReactNode } from "react"
import { runActiveEditor } from "../../utils/editorLifecycle"

type VoiceInputCommitMode = "live" | "deferred"

interface DeferredVoiceSegment {
	key: string
	text: string
	start: number
	end: number
	definite: boolean
}

interface SuperMagicVoiceInputProps {
	className?: string
	initValue?: JSONContent | string | null
	tiptapEditor?: Editor | null
	updateValue?: (value: JSONContent) => void
	iconSize?: number
	tooltipText?: string
	tooltipSide?: "top" | "bottom" | "left" | "right"
	commitMode?: VoiceInputCommitMode
	onRecordingChange?: (isRecording: boolean) => void
	onStatusChange?: (status: VoiceInputStatus) => void
	onDeferredTextChange?: (text: string) => void
	onWaveformLevelsChange?: (levels: number[]) => void
	children?: ReactNode
	toggleOnClick?: boolean
	waveformBarCount?: number
	waveformClassName?: string
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
			tiptapEditor,
			updateValue,
			iconSize = 20,
			className,
			tooltipText,
			tooltipSide,
			commitMode = "live",
			onRecordingChange,
			onStatusChange,
			onDeferredTextChange,
			onWaveformLevelsChange,
			children,
			toggleOnClick,
			waveformBarCount,
			waveformClassName,
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
		const deferredSegmentsRef = useRef<DeferredVoiceSegment[]>([])

		const handleResult = useMemoizedFn((result: string, response: VoiceResult) => {
			// Early return: abnormal data check
			if (result.startsWith('sult":{"additions')) {
				logger.error({
					eventKey: "abnormal_data_received_failed",
					errorKind: "unknown",
					error: response,
					message: "Abnormal data received",
				})
				return
			}

			// Early return: only process when recording
			if (!voiceInputRef.current?.isRecording) return

			if (commitMode === "deferred") {
				processDeferredUtterances(response.utterances, result)
				return
			}

			if (!tiptapEditor) return

			try {
				runActiveEditor(tiptapEditor, (editor) => {
					if (!isMobile && !editor.isFocused) {
						editor.commands.focus()
					}

					// Process each utterance segment incrementally
					processUtterances(response.utterances, editor)
				})

				// Update value after DOM updates
				requestAnimationFrame(() => {
					runActiveEditor(tiptapEditor, (editor) => {
						const newContent = editor.getJSON()
						updateValue?.(newContent)
					})
				})
			} catch (error) {
				logger.error({
					eventKey: "voice_input_processing_failed",
					errorKind: "unknown",
					error: error,
					message: "Voice input processing failed",
				})
			}
		})

		function getUtteranceKey(utterance: VoiceResultUtterance): string {
			return `${utterance.start_time}:${utterance.end_time}`
		}

		function emitDeferredText() {
			const deferredText = deferredSegmentsRef.current
				.slice()
				.sort((currentSegment, nextSegment) => currentSegment.start - nextSegment.start)
				.map((segment) => segment.text)
				.join("")
			onDeferredTextChange?.(deferredText)
		}

		function resetDeferredText() {
			deferredSegmentsRef.current = []
			onDeferredTextChange?.("")
		}

		function doVoiceSegmentsOverlap(
			currentSegment: Pick<DeferredVoiceSegment, "start" | "end">,
			nextSegment: Pick<DeferredVoiceSegment, "start" | "end">,
		): boolean {
			return currentSegment.start < nextSegment.end && nextSegment.start < currentSegment.end
		}

		function upsertDeferredSegment(nextSegment: DeferredVoiceSegment) {
			if (
				!nextSegment.definite &&
				deferredSegmentsRef.current.some(
					(segment) => segment.definite && doVoiceSegmentsOverlap(segment, nextSegment),
				)
			)
				return

			deferredSegmentsRef.current = deferredSegmentsRef.current.filter((segment) => {
				if (segment.key === nextSegment.key) return false
				if (!doVoiceSegmentsOverlap(segment, nextSegment)) return true

				return false
			})
			deferredSegmentsRef.current.push(nextSegment)
		}

		function applyDeferredFallbackText(fallbackText: string) {
			deferredSegmentsRef.current = fallbackText
				? [
						{
							key: "fallback",
							text: fallbackText,
							start: 0,
							end: fallbackText.length,
							definite: true,
						},
					]
				: []
			emitDeferredText()
		}

		function processDeferredUtterances(
			utterances: VoiceResultUtterance[] | undefined,
			fallbackText: string,
		) {
			if (!utterances || utterances.length === 0) {
				applyDeferredFallbackText(fallbackText)
				return
			}

			let hasAcceptedUtterance = false
			for (const utterance of utterances) {
				if (
					typeof utterance.start_time !== "number" ||
					typeof utterance.end_time !== "number" ||
					utterance.start_time === -1 ||
					utterance.end_time === -1
				)
					continue

				hasAcceptedUtterance = true
				const utteranceKey = getUtteranceKey(utterance)
				upsertDeferredSegment({
					key: utteranceKey,
					text: utterance.text,
					start: utterance.start_time,
					end: utterance.end_time,
					definite: Boolean(utterance.definite),
				})
			}

			if (hasAcceptedUtterance) {
				emitDeferredText()
				return
			}

			applyDeferredFallbackText(fallbackText)
		}

		// Helper: process utterances and update editor incrementally
		function processUtterances(utterances: VoiceResultUtterance[] | undefined, editor: Editor) {
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

				const chain = editor.chain()

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

				if (enableScrollIntoViewRef.current) {
					isProgrammaticScrollRef.current = true
					chain.scrollIntoView()
				}

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

			onRecordingChange?.(isRecording)

			if (isRecording && commitMode === "deferred") {
				resetDeferredText()
				return
			}

			if (isRecording && tiptapEditor) {
				runActiveEditor(tiptapEditor, (editor) => {
					enableScrollIntoViewRef.current = true
					shouldIgnoreNonDefiniteRef.current = false
					lastDefinitePositionRef.current = null
					lastTextSelectionRef.current = null

					// Calculate and save base insertion position
					const currentSelection = editor.state.selection
					const endPosition = editor.state.doc.content.size - 1
					const startPos = currentSelection.head > 1 ? currentSelection.head : endPosition
					lastTextSelectionRef.current = startPos

					console.log("初始化光标位置", startPos)

					if (!editor.isFocused && !isMobile) {
						console.log("初始化光标位置，聚焦编辑器")
						editor.commands.focus()
					}
				})
			} else if (!isRecording && tiptapEditor && !isMobile) {
				lastDefinitePositionRef.current = null
				shouldIgnoreNonDefiniteRef.current = false
				// Fix cursor position at recording end
				requestAnimationFrame(() => {
					runActiveEditor(tiptapEditor, (editor) => {
						if (lastTextSelectionRef.current !== null) {
							editor.commands.setTextSelection(lastTextSelectionRef.current)
							lastTextSelectionRef.current = null
						}
					})
				})
			}
		})

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
				stopRecording: () => {
					return voiceInputRef.current?.stopRecording()
				},
				disconnect: () => {
					voiceInputRef.current?.disconnect()
				},
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
				onStatusChange={onStatusChange}
				onRecordingChange={handleRecordingChange}
				onWaveformLevelsChange={onWaveformLevelsChange}
				iconSize={iconSize}
				className={className}
				toggleOnClick={toggleOnClick}
				waveformBarCount={waveformBarCount}
				waveformClassName={waveformClassName}
				enableHotkey={!isMobile}
				config={config}
				tooltipText={tooltipText}
				tooltipSide={tooltipSide}
			>
				{children}
			</VoiceInput>
		)
	},
)

export default SuperMagicVoiceInput
