import { describe, expect, it } from "vitest"
import { messageEditorContentVariants } from "../variants"

describe("messageEditorContentVariants", () => {
	it("aligns project file mentions with text in every editor size", () => {
		const smallClasses = messageEditorContentVariants({ size: "small" })
		const defaultClasses = messageEditorContentVariants({ size: "default" })
		const mobileClasses = messageEditorContentVariants({ size: "mobile" })

		for (const classes of [defaultClasses, smallClasses, mobileClasses]) {
			expect(classes).toContain("[&_.ProseMirror_.magic-mention]:!align-baseline")
			expect(classes).toContain("[&_.ProseMirror_.magic-mention]:leading-[inherit]")
			expect(classes).toContain(
				"[&_.ProseMirror_.magic-mention[data-type='project_file']:not([data-mention-node-view='file'])]:relative",
			)
			expect(classes).toContain(
				"[&_.ProseMirror_.magic-mention[data-type='project_file']:not([data-mention-node-view='file'])]:-top-px",
			)
			expect(classes).toContain(
				"[&_.ProseMirror_.magic-mention[data-type='project_file']:not([data-mention-node-view='file'])]:leading-[inherit]",
			)
			expect(classes).toContain(
				"[&_.ProseMirror_.magic-mention[data-mention-node-view='file']]:!align-middle",
			)
		}

		expect(smallClasses).toContain(
			"[&_.ProseMirror_.magic-mention[data-type='project_file']]:!text-[13px]",
		)
		expect(defaultClasses).toContain(
			"[&_.ProseMirror_.magic-mention[data-type='project_file']]:!text-[14px]",
		)
		expect(mobileClasses).toContain(
			"[&_.ProseMirror_.magic-mention[data-type='project_file']]:!text-[13px]",
		)
	})
})
