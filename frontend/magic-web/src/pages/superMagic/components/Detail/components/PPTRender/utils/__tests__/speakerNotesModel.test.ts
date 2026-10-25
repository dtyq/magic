import { describe, expect, it } from "vitest"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { resolveNotesModelId } from "../speakerNotesModel"

const model = (id: string, name = id, status = "normal") =>
	({ model_id: id, model_name: name, model_status: status }) as unknown as ModelItem

describe("resolveNotesModelId", () => {
	it("keeps the saved model while it is available", () => {
		expect(resolveNotesModelId([model("a"), model("b")], "b")).toBe("b")
	})

	it("falls back to the first concrete model when the saved one is gone", () => {
		expect(resolveNotesModelId([model("auto", "Auto"), model("a")], "missing")).toBe("a")
	})

	it("skips disabled models and uses auto only as a last resort", () => {
		expect(resolveNotesModelId([model("x", "x", "disabled"), model("auto", "Auto")])).toBe(
			"auto",
		)
	})

	it("returns undefined without models", () => {
		expect(resolveNotesModelId([])).toBeUndefined()
	})
})
