import { describe, expect, it, vi } from "vitest"
import { ElementTypeEnum } from "../../../../runtime/document/types"
import { resolveSeedanceComplianceTarget } from "../useSeedanceComplianceAction"

function createCanvas(
	content: Record<string, unknown>,
): Parameters<typeof resolveSeedanceComplianceTarget>[0] {
	return {
		elementManager: {
			getElementData: (elementId: string) => {
				void elementId
				return {
					id: "image-1",
					type: ElementTypeEnum.Image,
					name: "Portrait",
					contents: [content],
				} as never
			},
		},
		getEffectiveContent: <T extends { contentId: string }>(elementId: string) => {
			void elementId
			return content as T
		},
	} as unknown as Parameters<typeof resolveSeedanceComplianceTarget>[0]
}

describe("resolveSeedanceComplianceTarget", () => {
	it("routes an asset-backed asset:// element through the existing asset channel", () => {
		const resolveResourceReference = vi.fn()
		const target = resolveSeedanceComplianceTarget(
			createCanvas({ contentId: "content-1", src: "asset://asset-1", assetId: "asset-1" }),
			resolveResourceReference,
			"image-1",
		)

		expect(target?.assetId).toBe("asset-1")
		expect(target?.path).toBe("asset://asset-1")
		expect(resolveResourceReference).not.toHaveBeenCalled()
	})

	it("keeps an unbound workspace element on the project-path channel", () => {
		const resolveResourceReference = vi.fn().mockReturnValue({
			status: "resolved",
			resourceKind: "workspace-file",
			workspacePath: "/images/demo.png",
		})
		const target = resolveSeedanceComplianceTarget(
			createCanvas({ contentId: "content-1", src: "workspace://images/demo.png" }),
			resolveResourceReference,
			"image-1",
		)

		expect(target?.assetId).toBeUndefined()
		expect(target?.path).toBe("workspace://images/demo.png")
		expect(resolveResourceReference).toHaveBeenCalled()
	})
})
