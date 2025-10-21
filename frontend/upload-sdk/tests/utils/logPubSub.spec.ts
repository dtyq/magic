import { describe, test, expect, beforeEach, vi } from "vitest"
import logPubSub from "../../src/utils/logPubSub"
import { LogModule } from "../../src/types/log"

describe("logPubSub", () => {
  beforeEach(() => {
    // 清除所有订阅者
    // @ts-ignore - 访问私有属性进行测试
    logPubSub.callbacks = []
  })

  describe("subscribe方法", () => {
    test("应该能够添加订阅者", () => {
      const mockCallback = vi.fn()
      logPubSub.subscribe(mockCallback)

      // @ts-ignore - 访问私有属性进行测试
      expect(logPubSub.callbacks.length).toBe(1)
      // @ts-ignore
      expect(logPubSub.callbacks[0]).toBe(mockCallback)
    })

    test("应该能够添加多个订阅者", () => {
      const mockCallback1 = vi.fn()
      const mockCallback2 = vi.fn()
      const mockCallback3 = vi.fn()

      logPubSub.subscribe(mockCallback1)
      logPubSub.subscribe(mockCallback2)
      logPubSub.subscribe(mockCallback3)

      // @ts-ignore - 访问私有属性进行测试
      expect(logPubSub.callbacks.length).toBe(3)
    })
  })

  describe("report方法", () => {
    test("应该调用所有订阅的回调函数", () => {
      const mockCallback1 = vi.fn()
      const mockCallback2 = vi.fn()

      logPubSub.subscribe(mockCallback1)
      logPubSub.subscribe(mockCallback2)

      const logConfig: LogModule.CreateLogConfig = {
        type: "DEBUG",
        eventName: "upload",
        eventParams: "test_params",
      }

      logPubSub.report(logConfig)

      expect(mockCallback1).toHaveBeenCalledTimes(1)
      expect(mockCallback2).toHaveBeenCalledTimes(1)
    })

    test("当没有订阅者时应该不会有错误", () => {
      expect(() => {
        logPubSub.report({
          type: "DEBUG",
          eventName: "upload",
        })
      }).not.toThrow()
    })

    test("应该传递正确的日志数据给回调函数", () => {
      const mockCallback = vi.fn()
      logPubSub.subscribe(mockCallback)

      const logConfig: LogModule.CreateLogConfig = {
        type: "DEBUG",
        eventName: "upload",
        eventParams: "test_params",
        eventResponse: "test_response",
        extra: "test_extra",
      }

      logPubSub.report(logConfig)

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DEBUG",
          event_name: "upload",
          event_params: "test_params",
          event_response: "test_response",
          extra: "test_extra",
        }),
      )
    })
  })

  describe("createLog静态方法", () => {
    test("应该正确创建一个普通日志对象", () => {
      const logConfig: LogModule.CreateLogConfig = {
        type: "DEBUG",
        eventName: "upload",
        eventParams: "test_params",
        eventResponse: "test_response",
        extra: "test_extra",
      }

      // @ts-ignore - 访问静态方法
      const log = logPubSub.constructor.createLog(logConfig)

      expect(log).toEqual(
        expect.objectContaining({
          type: "DEBUG",
          event_name: "upload",
          event_params: "test_params",
          event_response: "test_response",
          extra: "test_extra",
          exception_type: "",
          exception_message: "",
          exception_file: "",
          exception_line: "",
          exception_row: "",
        }),
      )

      expect(log.time).toBeInstanceOf(Date)
      expect(log.version).toBe("Upload-SDK.js VERSION")
    })

    test("应该正确创建一个错误日志对象", () => {
      const error = new Error("Test error message")
      error.stack =
        "Error: Test error message\n at TestFunction (test.ts:123:45)"

      const logConfig: LogModule.CreateLogConfig = {
        type: "ERROR",
        eventName: "download",
        error,
      }

      // @ts-ignore - 访问静态方法
      const log = logPubSub.constructor.createLog(logConfig)

      expect(log).toEqual(
        expect.objectContaining({
          type: "ERROR",
          event_name: "download",
          exception_type: "Error",
          exception_message: "Test error message",
          exception_file: "test.ts",
          exception_line: "123",
          exception_row: "45",
        }),
      )
    })

    test("应该使用默认值填充可选字段", () => {
      const logConfig: LogModule.CreateLogConfig = {
        type: "WARN",
        eventName: "upload",
      }

      // @ts-ignore - 访问静态方法
      const log = logPubSub.constructor.createLog(logConfig)

      expect(log).toEqual(
        expect.objectContaining({
          event_params: "",
          event_response: "",
          extra: "",
        }),
      )
    })
  })
})
