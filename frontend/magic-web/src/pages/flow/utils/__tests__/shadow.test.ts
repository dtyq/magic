import { describe, expect, it, vi } from "vitest"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { shadowFlow, shadowNode, unShadowFlow } from "../helpers"
import { unshadow } from "@/utils/shadow"

// 隔离编辑器及接口依赖，只执行真实代码节点的编解码逻辑。
vi.mock("antd", () => ({ Switch: vi.fn() }))
vi.mock("@dtyq/magic-flow/dist/MagicConditionEdit/types/common", () => ({ Common: {} }))
vi.mock("@dtyq/magic-flow/dist/common/BaseUI/Input", () => ({ default: vi.fn() }))
vi.mock("@dtyq/magic-flow/dist/MagicExpressionWidget/types", () => ({
	FormItemType: {},
	LabelTypeMap: {},
}))
vi.mock("@dtyq/magic-flow/dist/MagicFlow/store/index", () => ({ flowStore: {} }))
vi.mock("@dtyq/magic-flow/dist/MagicFlow/utils", () => ({ getLatestNodeVersion: vi.fn() }))
vi.mock("@dtyq/magic-flow/dist/MagicJsonSchemaEditor", () => ({ JsonSchemaEditorProps: {} }))
vi.mock("@dtyq/magic-flow/dist/MagicJsonSchemaEditor/utils/SchemaUtils", () => ({
	getDefaultSchema: vi.fn(),
}))
vi.mock("@/stores/flow", () => ({ useFlowStore: {} }))
vi.mock("@/apis", () => ({ ContactApi: {} }))

describe("流程代码多语言传输", () => {
	it("整流程及单节点保留代码且不修改原数据", () => {
		const code = 'print("저 코드 မြန်မာ 日本語")'
		const node = { node_type: "5", params: { code } } as MagicFlow.Node
		const flow = {
			nodes: [node, { node_type: "2", params: { code: "raw" } }],
		} as MagicFlow.Flow
		const encoded = JSON.parse(JSON.stringify(shadowFlow(flow)))
		expect(encoded.nodes[0].params.code).toMatch(/^SHADOWED2_/)
		expect(unShadowFlow(encoded)).toEqual(flow)
		expect(unshadow(shadowNode(node).params.code)).toBe(code)
		expect(flow.nodes[0].params.code).toBe(code)
		expect(encoded.nodes[1].params.code).toBe("raw")
	})
})
