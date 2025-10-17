import { describe, test, expect, beforeEach, vi } from "vitest"
import EventEmitter from "../../src/utils/EventEmitter"

describe("EventEmitter", () => {
  type TestListener = (message: string, count: number) => void
  let emitter: EventEmitter<TestListener>

  beforeEach(() => {
    emitter = new EventEmitter<TestListener>()
  })

  test("应该可以注册事件监听器", () => {
    const mockFn = vi.fn()
    emitter.on("testEvent", mockFn);
    expect(emitter.observers).toHaveProperty("testEvent")
    expect(emitter.observers.testEvent).toBe(mockFn)
  })

  test("不应重复注册同名事件监听器", () => {
    const mockFn1 = vi.fn()
    const mockFn2 = vi.fn()
    emitter.on("testEvent", mockFn1)
    emitter.on("testEvent", mockFn2) // 这个不应该被注册

    emitter.emit("testEvent", "hello", 123)
    expect(mockFn1).toHaveBeenCalledWith("hello", 123)
    expect(mockFn2).not.toHaveBeenCalled()
  })

  test("应该能够触发事件并执行监听器", () => {
    const mockFn = vi.fn()
    emitter.on("testEvent", mockFn)

    emitter.emit("testEvent", "test message", 42)
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(mockFn).toHaveBeenCalledWith("test message", 42)
  })

  test("对于不存在的事件，emit 不应该抛出错误", () => {
    expect(() => {
      emitter.emit("nonExistentEvent", "test", 123)
    }).not.toThrow()
  })

  test("应该能够移除事件监听器", () => {
    const mockFn = vi.fn()
    emitter.on("testEvent", mockFn)
    emitter.off("testEvent")

    emitter.emit("testEvent", "test", 123)
    expect(mockFn).not.toHaveBeenCalled()
    expect(emitter.observers).not.toHaveProperty("testEvent")
  })

  test("移除不存在的事件监听器不应该抛出错误", () => {
    expect(() => {
      emitter.off("nonExistentEvent")
    }).not.toThrow()
  })

  test("应该可以注册多个不同名称的事件监听器", () => {
    const mockFn1 = vi.fn()
    const mockFn2 = vi.fn()

    emitter.on("event1", mockFn1)
    emitter.on("event2", mockFn2)

    emitter.emit("event1", "hello", 1)
    emitter.emit("event2", "world", 2)

    expect(mockFn1).toHaveBeenCalledWith("hello", 1)
    expect(mockFn2).toHaveBeenCalledWith("world", 2)
  })
})
