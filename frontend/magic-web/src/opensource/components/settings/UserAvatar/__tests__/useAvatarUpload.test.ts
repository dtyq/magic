import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { message } from "antd"
import { useAvatarUpload, UploadStatus } from "../hooks/useAvatarUpload"

// Mock dependencies
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("antd", () => ({
	message: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

vi.mock("@/opensource/hooks/useUploadFiles", () => ({
	useUpload: () => ({
		upload: vi.fn(),
		reportFiles: vi.fn(),
	}),
}))

vi.mock("@/apis", () => ({
	FileApi: {
		getFileUrl: vi.fn(),
	},
	MagicUserApi: {
		updateUserInfo: vi.fn(),
	},
}))

vi.mock("@/services", () => ({
	service: {
		get: vi.fn(() => ({
			refreshUserInfo: vi.fn(),
		})),
	},
}))

vi.mock("../utils", () => ({
	compressionFile: vi.fn(),
}))

vi.mock("@/opensource/pages/vectorKnowledge/utils", () => ({
	genFileData: vi.fn(),
}))

vi.mock("@/opensource/utils/file", () => ({
	getFileNameExtension: vi.fn(),
}))

describe("useAvatarUpload", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should initialize with idle status", () => {
		const { result } = renderHook(() => useAvatarUpload())

		expect(result.current.uploadStatus).toBe(UploadStatus.IDLE)
		expect(result.current.isUploading).toBe(false)
	})

	it("should validate file size", async () => {
		const { result } = renderHook(() => useAvatarUpload())

		// Create a file larger than 2MB
		const largeFile = new File(["x".repeat(3 * 1024 * 1024)], "large.jpg", {
			type: "image/jpeg",
		})

		await act(async () => {
			await result.current.uploadAvatar([largeFile])
		})

		expect(message.error).toHaveBeenCalledWith("setting.uploadAvatar.fileTooLarge")
	})

	it("should validate file type", async () => {
		const { result } = renderHook(() => useAvatarUpload())

		// Create a file with invalid type
		const invalidFile = new File(["content"], "file.txt", { type: "text/plain" })

		await act(async () => {
			await result.current.uploadAvatar([invalidFile])
		})

		expect(message.error).toHaveBeenCalledWith("setting.uploadAvatar.invalidFileType")
	})

	it("should handle empty file list", async () => {
		const { result } = renderHook(() => useAvatarUpload())

		await act(async () => {
			await result.current.uploadAvatar([])
		})

		expect(message.error).toHaveBeenCalledWith("setting.uploadAvatar.noFileSelected")
	})

	it("should accept custom configuration", () => {
		const customConfig = {
			maxFileSize: 1024 * 1024, // 1MB
			compressionQuality: 0.8,
		}

		const { result } = renderHook(() => useAvatarUpload({ config: customConfig }))

		// The hook should use the custom configuration
		expect(result.current.uploadStatus).toBe(UploadStatus.IDLE)
	})
})
