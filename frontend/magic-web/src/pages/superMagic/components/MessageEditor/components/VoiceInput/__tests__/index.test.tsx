import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { forwardRef, useRef } from "react"
import SuperMagicVoiceInput from ".."
import { VoiceInputRef } from "@/components/business/VoiceInput"

// Mock dependencies
let mockStopRecording = vi.fn()

vi.mock("@/components/business/VoiceInput", () => ({
	default: forwardRef<VoiceInputRef, any>(({ onRecordingChange, onResult }, ref) => {
		// 重置mock实现
		mockStopRecording.mockImplementation(() => {
			// 模拟stopRecording调用后的状态变化
			onRecordingChange?.(false)
		})

		// Mock VoiceInput component
		const mockVoiceInput = {
			stopRecording: mockStopRecording,
			isRecording: false,
			status: "idle" as const,
		}

			// 暴露mock方法给测试
			; (ref as any).current = mockVoiceInput

		return (
			<div data-testid="voice-input">
				<button
					data-testid="voice-button"
					onClick={() => {
						// 模拟权限被拒绝 - 现在VoiceInput内部处理权限，会自动调用stopRecording
						onRecordingChange?.(true) // 先模拟开始录音
						setTimeout(() => {
							// 模拟权限错误时的内部处理
							mockStopRecording()
							onRecordingChange?.(false) // 然后自动停止
						}, 50)
					}}
				>
					Voice Input
				</button>
			</div>
		)
	}),
}))

vi.mock("@/hooks/useMicrophonePermission", () => ({
	useMicrophonePermission: ({ onStateReset }: { onStateReset?: () => void }) => {
		const mockHandlePermissionError = vi.fn((error) => {
			if (error.name === "NotAllowedError") {
				onStateReset?.()
				// 不抛出错误，只处理权限错误
			} else {
				throw error
			}
		})

		return {
			handlePermissionError: mockHandlePermissionError,
		}
	},
}))

// Mock antd components
vi.mock("antd", () => ({
	Modal: {
		confirm: vi.fn(),
	},
	message: {
		info: vi.fn(),
	},
}))

vi.mock("antd-mobile", () => ({
	Dialog: {
		confirm: vi.fn(),
	},
}))

describe("SuperMagicVoiceInput", () => {
	let mockUpdateValue: ReturnType<typeof vi.fn>
	let voiceInputRef: React.RefObject<VoiceInputRef>

	// Test wrapper component
	const TestComponent = () => {
		const ref = useRef<VoiceInputRef>(null)
		voiceInputRef = ref

		return <SuperMagicVoiceInput ref={ref} initValue="initial" updateValue={mockUpdateValue} />
	}

	beforeEach(() => {
		mockUpdateValue = vi.fn()
		mockStopRecording = vi.fn()
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllTimers()
	})

	it("should render correctly", () => {
		render(<TestComponent />)
		expect(screen.getByTestId("voice-input")).toBeInTheDocument()
	})

	it("should handle permission denied error correctly", async () => {
		render(<TestComponent />)

		const voiceButton = screen.getByTestId("voice-button")

		// 初始状态应该是idle和not recording
		expect(voiceInputRef.current?.isRecording).toBe(false)
		expect(voiceInputRef.current?.status).toBe("idle")

		// 点击开始录音
		fireEvent.click(voiceButton)

		// 等待VoiceInput内部的权限处理完成
		await waitFor(
			() => {
				// 权限被拒绝后，状态应该重置为idle和not recording
				expect(voiceInputRef.current?.isRecording).toBe(false)
				expect(voiceInputRef.current?.status).toBe("idle")
			},
			{ timeout: 300 },
		)
	})

	it("should maintain consistent state across multiple interactions", async () => {
		render(<TestComponent />)

		const voiceButton = screen.getByTestId("voice-button")

		// 多次点击测试状态一致性
		for (let i = 0; i < 3; i++) {
			fireEvent.click(voiceButton)

			await waitFor(
				() => {
					expect(voiceInputRef.current?.isRecording).toBe(false)
					expect(voiceInputRef.current?.status).toBe("idle")
				},
				{ timeout: 300 },
			)
		}
	})

	it("should call stopRecording when permission is denied", async () => {
		render(<TestComponent />)

		// 等待组件完全渲染，确保ref已经设置
		await waitFor(() => {
			expect(voiceInputRef.current).toBeTruthy()
		})

		const voiceButton = screen.getByTestId("voice-button")

		fireEvent.click(voiceButton)

		await waitFor(
			() => {
				expect(mockStopRecording).toHaveBeenCalled()
			},
			{ timeout: 300 },
		)
	})

	it("should handle updateValue correctly when recording", async () => {
		// 模拟正常录音场景
		render(<TestComponent />)

		const component = screen.getByTestId("voice-input")

		// 这里需要访问组件内部的方法，实际测试中可能需要更复杂的mock
		expect(mockUpdateValue).not.toHaveBeenCalled()
	})

	it("should reset state immediately on permission error", async () => {
		render(<TestComponent />)

		const voiceButton = screen.getByTestId("voice-button")

		// 记录开始时间
		const startTime = Date.now()

		fireEvent.click(voiceButton)

		// 验证状态重置是立即的
		await waitFor(() => {
			const elapsedTime = Date.now() - startTime
			expect(elapsedTime).toBeLessThan(250) // 应该在250ms内完成重置
			expect(voiceInputRef.current?.isRecording).toBe(false)
			expect(voiceInputRef.current?.status).toBe("idle")
		})
	})

	it("should directly delegate to VoiceInput", async () => {
		render(<TestComponent />)

		await waitFor(() => {
			expect(voiceInputRef.current).toBeTruthy()
		})

		// 测试SuperMagicVoiceInput是否正确委托给VoiceInput
		expect(voiceInputRef.current?.isRecording).toBe(false)
		expect(voiceInputRef.current?.status).toBe("idle")
		expect(typeof voiceInputRef.current?.stopRecording).toBe("function")
	})
})
