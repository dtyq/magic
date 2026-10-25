import { beforeEach, describe, expect, it, vi } from "vitest"

const sdkMocks = vi.hoisted(() => ({
	upload: vi.fn(),
	uploadConfigs: [] as Array<{ fileName?: string }>,
	progressCallback: undefined as ((progress: number) => void) | undefined,
	successCallback: undefined as ((response: { data: { path: string } }) => void) | undefined,
}))

const apiMocks = vi.hoisted(() => ({
	getSnowflakeIds: vi.fn(),
}))

vi.mock("@dtyq/upload-sdk", () => ({
	Upload: class {
		upload(config: { fileName?: string }) {
			sdkMocks.uploadConfigs.push(config)
			const callbacks = {
				progress: (callback: (progress: number) => void) => {
					sdkMocks.progressCallback = callback
				},
				success: (callback: (response: { data: { path: string } }) => void) => {
					sdkMocks.successCallback = callback
				},
				fail: vi.fn(),
				cancel: vi.fn(),
				pause: vi.fn(),
				resume: vi.fn(),
			}
			sdkMocks.upload(callbacks)
			return callbacks
		}
	},
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getSnowflakeIds: apiMocks.getSnowflakeIds,
	},
}))

vi.mock("@/models/user", () => ({
	userStore: {
		user: {
			organizationCode: "organization-1",
			authorization: "authorization",
		},
	},
}))

vi.mock("@/utils/env", () => ({
	env: vi.fn(() => "https://example.com"),
	isCommercial: vi.fn(() => false),
}))

vi.mock("@/utils/http", () => ({
	genRequestUrl: vi.fn((path: string) => path),
}))

vi.mock("@/infrastructure/logger", () => ({
	logger: {
		createLogger: () => ({
			error: vi.fn(),
			warn: vi.fn(),
		}),
	},
}))

import { UploadService } from "../UploadService"

function createFileData(name = "demo.txt") {
	return {
		id: "file-1",
		name,
		file: new File(["demo"], name, { type: "text/plain" }),
		status: "init" as const,
	}
}

async function waitForSdkUpload() {
	await vi.waitFor(() => {
		expect(sdkMocks.upload).toHaveBeenCalled()
	})
}

describe("UploadService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		sdkMocks.uploadConfigs = []
		sdkMocks.progressCallback = undefined
		sdkMocks.successCallback = undefined
		apiMocks.getSnowflakeIds.mockResolvedValue({ ids: ["snowflake-1"] })
	})

	it("uses snowflake ids as OSS names and keeps original names in the result", async () => {
		const fileData = createFileData("report.pdf")
		const service = new UploadService<typeof fileData>()

		const uploadPromise = service.upload({ fileList: [fileData] })
		await waitForSdkUpload()
		sdkMocks.successCallback?.({ data: { path: "uploads/snowflake-1" } })
		const result = await uploadPromise

		expect(apiMocks.getSnowflakeIds).toHaveBeenCalledWith({ count: 1 })
		expect(sdkMocks.uploadConfigs[0]).toMatchObject({ fileName: "snowflake-1" })
		expect(result.fullfilled[0]?.value).toMatchObject({
			key: "uploads/snowflake-1",
			name: "report.pdf",
		})
	})

	it("does not upload when snowflake id generation fails", async () => {
		apiMocks.getSnowflakeIds.mockResolvedValueOnce({ ids: [] })
		const fileData = createFileData()
		const onFail = vi.fn()
		const service = new UploadService<typeof fileData>()

		const result = await service.upload({ fileList: [fileData], onFail })

		expect(sdkMocks.upload).not.toHaveBeenCalled()
		expect(result.rejected).toHaveLength(1)
		expect(onFail).toHaveBeenCalled()
	})

	it("forwards zero and normalized finite progress values", async () => {
		const onProgress = vi.fn()
		const fileData = createFileData()
		const service = new UploadService<typeof fileData>()

		const uploadPromise = service.upload({
			fileList: [fileData],
			onProgress,
		})

		await waitForSdkUpload()
		sdkMocks.progressCallback?.(0)
		sdkMocks.progressCallback?.(-1)
		sdkMocks.progressCallback?.(42.5)
		sdkMocks.progressCallback?.(101)
		sdkMocks.progressCallback?.(Number.NaN)
		sdkMocks.progressCallback?.(Number.POSITIVE_INFINITY)
		sdkMocks.successCallback?.({ data: { path: "uploads/demo.txt" } })
		await uploadPromise

		expect(onProgress.mock.calls.map(([, progress]) => progress)).toEqual([0, 0, 42.5, 100])
	})
})
