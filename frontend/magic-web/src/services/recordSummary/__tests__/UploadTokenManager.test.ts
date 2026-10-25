import { beforeEach, describe, expect, it, vi } from "vitest"
import { SuperMagicApi } from "@/apis"
import { createTaskEndError, isTaskEndError, type TaskEndError } from "../RecordingErrorManager"
import { UploadTokenManager } from "../UploadTokenManager"

vi.mock("@/services/recordSummary/utils/RecordingLogger", () => {
	const logger = {
		log: vi.fn(),
		report: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		namespace: vi.fn(() => logger),
	}
	return { recordingLogger: logger }
})

vi.mock("../RecordingErrorManager", async (importOriginal) => ({
	...(await importOriginal<typeof import("../RecordingErrorManager")>()),
	isTaskEndError: vi.fn(() => false),
	createTaskEndError: vi.fn(),
	defaultErrorManager: { handleTaskEnd: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getRecordingSummaryUploadToken: vi.fn(),
	},
}))

const TASK_END_CODE = 43200

const SECRET_ERRORS = {
	authorization: new Error("authorization: Bearer secret-authorization-value"),
	bearer: new Error("Unauthorized Bearer test-upload-bearer-credential"),
	urlQueryToken: new Error(
		"Failed to fetch https://oss.example.com/upload?token=secret-query-token&authorization=Bearer%20abc",
	),
	jsonBodyToken: new Error(
		'API rejected {"token":"secret-json-token","access_token":"secret-access","refresh_token":"secret-refresh"}',
	),
}

function expectNoSecretLeak(message: string) {
	expect(message).not.toContain("secret-authorization-value")
	expect(message).not.toContain("test-upload-bearer-credential")
	expect(message).not.toContain("secret-query-token")
	expect(message).not.toContain("secret-json-token")
	expect(message).not.toContain("secret-access")
	expect(message).not.toContain("secret-refresh")
	expect(message).not.toMatch(/Bearer\s+eyJ/)
	expect(message).not.toContain("https://oss.example.com")
}

function asTaskEndError(apiError: Error): TaskEndError {
	const error = new Error(apiError.message) as TaskEndError
	error.code = TASK_END_CODE
	error.sessionId = "session-1"
	return error
}

function mockLeakyTaskEndError(originalMessage: string) {
	vi.mocked(isTaskEndError).mockImplementation(
		(error): error is TaskEndError =>
			error !== null &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code: number }).code === TASK_END_CODE,
	)
	// Preserve the original secret-bearing message to exercise the rethrow path
	vi.mocked(createTaskEndError).mockImplementation((sessionId, code) => {
		const error = new Error(originalMessage) as TaskEndError
		error.code = code ?? TASK_END_CODE
		error.sessionId = sessionId
		return error
	})
}

describe("UploadTokenManager", () => {
	it("forwards a nested project-not-found code and does not retry", async () => {
		const original = { response: { data: { code: "51200" } } }
		vi.mocked(isTaskEndError).mockImplementationOnce((_error): _error is TaskEndError => true)
		vi.mocked(createTaskEndError).mockImplementationOnce(
			(sessionId, code) =>
				Object.assign(new Error("ended"), { sessionId, code }) as TaskEndError,
		)
		vi.mocked(SuperMagicApi.getRecordingSummaryUploadToken).mockRejectedValueOnce(original)
		const onTaskEnd = vi.fn()
		const manager = new UploadTokenManager({ maxRetries: 3, retryInterval: 0 }, onTaskEnd)
		await expect(manager.getToken("session-1", "topic-1")).rejects.toMatchObject({
			code: 51200,
			sessionId: "session-1",
		})
		expect(onTaskEnd).toHaveBeenCalledExactlyOnceWith("session-1", 51200)
		expect(SuperMagicApi.getRecordingSummaryUploadToken).toHaveBeenCalledOnce()
	})
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it.each(Object.entries(SECRET_ERRORS))(
		"does not leak %s secrets when token fetch retries are exhausted",
		async (_name, apiError) => {
			vi.mocked(SuperMagicApi.getRecordingSummaryUploadToken).mockRejectedValue(apiError)
			const manager = new UploadTokenManager({
				maxRetries: 0,
				retryInterval: 0,
			})

			const error = await manager.getToken("session-1", "topic-1").catch((err) => err)
			expect(error).toBeInstanceOf(Error)
			const message = (error as Error).message
			expect(message).toMatch(/Failed to fetch token after 0 retries/)
			expectNoSecretLeak(message)
		},
	)

	it.each(Object.entries(SECRET_ERRORS))(
		"does not leak %s secrets when getToken hits a task-end error",
		async (_name, apiError) => {
			const taskEndError = asTaskEndError(apiError)
			mockLeakyTaskEndError(taskEndError.message)
			vi.mocked(SuperMagicApi.getRecordingSummaryUploadToken).mockRejectedValue(taskEndError)

			const manager = new UploadTokenManager({
				maxRetries: 0,
				retryInterval: 0,
			})
			const error = await manager.getToken("session-1", "topic-1").catch((err) => err)

			expect(error).toBeInstanceOf(Error)
			expect((error as TaskEndError).code).toBe(TASK_END_CODE)
			expect((error as TaskEndError).sessionId).toBe("session-1")
			expect(isTaskEndError(error)).toBe(true)
			expectNoSecretLeak((error as Error).message)
		},
	)

	it.each(Object.entries(SECRET_ERRORS))(
		"does not leak %s secrets when forceRefreshToken hits a task-end error",
		async (_name, apiError) => {
			vi.mocked(SuperMagicApi.getRecordingSummaryUploadToken).mockResolvedValueOnce({
				sts_token: { token: "cached-token" },
				expires_in: 3600,
			} as never)

			const manager = new UploadTokenManager({
				maxRetries: 0,
				retryInterval: 0,
			})
			await manager.getToken("session-1", "topic-1")

			const taskEndError = asTaskEndError(apiError)
			mockLeakyTaskEndError(taskEndError.message)
			vi.mocked(SuperMagicApi.getRecordingSummaryUploadToken).mockRejectedValue(taskEndError)

			const error = await manager.forceRefreshToken("session-1").catch((err) => err)

			expect(error).toBeInstanceOf(Error)
			expect((error as TaskEndError).code).toBe(TASK_END_CODE)
			expect((error as TaskEndError).sessionId).toBe("session-1")
			expect(isTaskEndError(error)).toBe(true)
			expectNoSecretLeak((error as Error).message)
		},
	)
})
