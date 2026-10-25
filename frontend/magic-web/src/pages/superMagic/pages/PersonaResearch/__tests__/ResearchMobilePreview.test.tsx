import { createRef, forwardRef, useImperativeHandle } from "react"
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ResearchMobilePreview, {
	type ResearchMobilePreviewRef,
} from "../components/ResearchMobilePreview"

const mocks = vi.hoisted(() => ({
	open: vi.fn(),
	updateAttachments: vi.fn(),
	store: {
		selectedProject: { id: "project-1" },
		selectedTopic: { id: "topic-1" },
		attachments: [{ file_id: "tree" }],
		attachmentList: [{ file_id: "f1", file_name: "plan.md", file_extension: "md" }],
		isReadOnly: false,
	},
	pubsubOptions: undefined as undefined | { onFileClick: (file?: unknown) => void },
}))

vi.mock("../context", () => ({ usePersonaResearchStore: () => mocks.store }))
vi.mock("@/pages/superMagicMobile/components/PreviewDetailPopup", () => ({
	default: forwardRef((_props: unknown, ref) => {
		useImperativeHandle(ref, () => ({
			open: mocks.open,
			updateAttachments: mocks.updateAttachments,
		}))
		return null
	}),
}))
vi.mock("@/pages/superMagic/components/KnowledgeBasePreviewPopup", () => ({ default: () => null }))
vi.mock("@/pages/superMagic/components/MicroAppPreviewPopup", () => ({ default: () => null }))
vi.mock("@/pages/superMagic/hooks/useMobileFilePreviewPubSub", () => ({
	useMobileFilePreviewPubSub: (options: { onFileClick: (file?: unknown) => void }) => {
		mocks.pubsubOptions = options
	},
}))
vi.mock("@/pages/superMagic/hooks/useMobileKnowledgeBasePreview", () => ({
	useMobileKnowledgeBasePreview: () => ({}),
}))
vi.mock("@/pages/superMagic/hooks/useMobileMicroAppPreview", () => ({
	useMobileMicroAppPreview: () => ({}),
}))

function setup(routeFile = vi.fn(() => false)) {
	const ref = createRef<ResearchMobilePreviewRef>()
	render(<ResearchMobilePreview ref={ref} routeFile={routeFile} />)
	return { ref, routeFile }
}

describe("ResearchMobilePreview", () => {
	beforeEach(() => {
		mocks.open.mockReset()
		mocks.updateAttachments.mockReset()
		mocks.pubsubOptions = undefined
	})

	it("opens a study file in the shared mobile preview popup with the project files", () => {
		const { ref } = setup()
		ref.current?.openFile({ file_id: "f1", file_name: "plan.md" })
		expect(mocks.open).toHaveBeenCalledTimes(1)
		const [detail, tree, list] = mocks.open.mock.calls[0]
		expect(detail.currentFileId).toBe("f1")
		expect(tree).toBe(mocks.store.attachments)
		expect(list).toBe(mocks.store.attachmentList)
	})

	it("leaves contract files to their own UI instead of previewing them", () => {
		const { ref, routeFile } = setup(vi.fn(() => true))
		ref.current?.openFile({ file_id: "f1", file_name: "persona.json" })
		expect(routeFile).toHaveBeenCalled()
		expect(mocks.open).not.toHaveBeenCalled()
	})

	it("passes a conversation tool step straight to the popup", () => {
		const { ref } = setup()
		const detail = { type: "search", data: {}, currentFileId: "" }
		ref.current?.openDetail(detail)
		expect(mocks.open).toHaveBeenCalledWith(
			detail,
			mocks.store.attachments,
			mocks.store.attachmentList,
		)
		ref.current?.openDetail(undefined)
		expect(mocks.open).toHaveBeenCalledTimes(1)
	})

	it("opens files published by message cards through the same path", () => {
		setup()
		mocks.pubsubOptions?.onFileClick({ file_id: "f1", file_name: "plan.md" })
		expect(mocks.open).toHaveBeenCalledTimes(1)
	})

	it("refreshes the popup's file context when the project tree changes", () => {
		setup()
		expect(mocks.updateAttachments).toHaveBeenCalledWith(
			mocks.store.attachments,
			mocks.store.attachmentList,
		)
	})
})
