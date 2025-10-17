// 更简单的测试策略，仅测试类的公共API
import { describe, test, expect, beforeEach, vi } from "vitest"
import { UploadManger } from "../../src/utils/UploadManger"
import type { Method } from "../../src/types/request"

describe("UploadManger 类测试", () => {
	let uploadManger: UploadManger

	beforeEach(() => {
		vi.resetModules() // 重置所有模块的状态
		uploadManger = new UploadManger()
	})

	describe("任务控制方法", () => {
		test("pauseAllTask 方法应该调用每个上传任务的 pause 方法", () => {
			const mockPause = vi.fn()
			// 直接修改任务对象
			// @ts-ignore - 访问私有属性进行测试
			uploadManger["tasks"] = {
				"test-id": { pause: mockPause },
			}

			uploadManger.pauseAllTask()
			expect(mockPause).toHaveBeenCalled()
		})

		test("resumeAllTask 方法应该调用每个上传任务的 resume 方法", () => {
			const mockResume = vi.fn()
			// @ts-ignore - 访问私有属性进行测试
			uploadManger["tasks"] = {
				"test-id": { resume: mockResume },
			}

			uploadManger.resumeAllTask()
			expect(mockResume).toHaveBeenCalled()
		})

		test("cancelAllTask 方法应该调用每个上传任务的 cancel 方法", () => {
			const mockCancel = vi.fn()
			// @ts-ignore - 访问私有属性进行测试
			uploadManger["tasks"] = {
				"test-id": { cancel: mockCancel },
			}

			uploadManger.cancelAllTask()
			expect(mockCancel).toHaveBeenCalled()
		})

		test("控制方法应该能安全处理空任务列表", () => {
			// @ts-ignore - 访问私有属性进行测试
			uploadManger["tasks"] = {}

			expect(() => {
				uploadManger.pauseAllTask()
				uploadManger.resumeAllTask()
				uploadManger.cancelAllTask()
			}).not.toThrow()
		})
	})

	describe("createTask 方法", () => {
		test("应该返回包含所有必要方法的任务接口", () => {
			const mockFile = new File(["test content"], "test.txt", {
				type: "text/plain",
			})
			const task = uploadManger.createTask(
				mockFile,
				"test.txt",
				{
					url: "http://example.com",
					method: "POST" as Method,
					file: mockFile,
					fileName: "test.txt",
				},
				{},
			)

			// 验证返回的任务接口包含所有预期的方法
			expect(task).toBeDefined()
			expect(task.success).toBeInstanceOf(Function)
			expect(task.fail).toBeInstanceOf(Function)
			expect(task.progress).toBeInstanceOf(Function)
			expect(task.cancel).toBeInstanceOf(Function)
			expect(task.pause).toBeInstanceOf(Function)
			expect(task.resume).toBeInstanceOf(Function)
		})
	})
})
