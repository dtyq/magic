import { describe, test, expect } from "vitest"
import { nanoid } from "../../src/utils/nanoid"

describe("nanoid", () => {
  test("应该生成指定长度的唯一标识", () => {
    const id = nanoid(10);
    expect(id.length).toBe(10);
  });

  test("默认应该生成21位长度的唯一标识", () => {
    const id = nanoid();
    expect(id.length).toBe(21);
  });

  test("生成的ID应该只包含合法字符（字母、数字、- 或 _）", () => {
    const id = nanoid(30);
    expect(id).toMatch(/^[a-zA-Z0-9\-_]+$/);
  });

  test("多次调用应该生成不同的ID", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(nanoid(15));
    }
    expect(ids.size).toBe(100); // 所有生成的ID都应该是唯一的
  });
});
