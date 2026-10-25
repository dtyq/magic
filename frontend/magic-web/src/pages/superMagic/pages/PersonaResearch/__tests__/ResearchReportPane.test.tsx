import { createRef, forwardRef, useImperativeHandle } from "react"
import { act, render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ResearchReportPane, { type ResearchReportPaneRef } from "../components/ResearchReportPane"

const mocks = vi.hoisted(() => ({
	isMobile: true,
	open: vi.fn(),
	updateAttachments: vi.fn(),
	popupProps: [] as Array<Record<string, unknown>>,
	detailMounted: 0,
	store: {
		selectedProject: { id: "project-1" },
		selectedTopic: { id: "topic-1" },
		attachments: [{ file_id: "tree" }],
		attachmentList: [{ file_id: "report-1", file_name: "report.html", file_extension: "html" }],
		studyAttachments: {
			report: { file_id: "report-1", file_name: "report.html", file_extension: "html" },
		},
		projectFilesStore: { attachmentLoadState: "ready" },
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.isMobile }))
vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("../context", () => ({ usePersonaResearchStore: () => mocks.store }))
vi.mock("../services/researchFiles", () => ({
	attachmentVersionKey: (file: { file_id: string }) => `${file.file_id}:v1`,
}))
vi.mock("@/pages/superMagicMobile/components/PreviewDetailPopup", () => ({
	default: forwardRef((props: Record<string, unknown>, ref) => {
		mocks.popupProps.push(props)
		useImperativeHandle(ref, () => ({
			open: mocks.open,
			updateAttachments: mocks.updateAttachments,
		}))
		return null
	}),
}))
vi.mock("@/pages/superMagic/components/Detail", () => ({
	default: forwardRef(() => {
		mocks.detailMounted += 1
		return null
	}),
}))

describe("ResearchReportPane", () => {
	beforeEach(() => {
		mocks.isMobile = true
		mocks.open.mockReset()
		mocks.updateAttachments.mockReset()
		mocks.popupProps.length = 0
		mocks.detailMounted = 0
	})

	it("renders the report in place with the shared mobile preview on phones", () => {
		render(<ResearchReportPane generating={false} />)
		expect(mocks.detailMounted).toBe(0)
		expect(mocks.popupProps.at(-1)).toMatchObject({ inline: true, allowEdit: false })
		expect(mocks.open).toHaveBeenCalledTimes(1)
		const [detail, tree, list] = mocks.open.mock.calls[0]
		expect(detail.currentFileId).toBe("report-1")
		expect(tree).toBe(mocks.store.attachments)
		expect(list).toBe(mocks.store.attachmentList)
	})

	it("reloads the report when refresh is requested", () => {
		const ref = createRef<ResearchReportPaneRef>()
		render(<ResearchReportPane ref={ref} generating={false} />)
		act(() => ref.current?.refresh())
		// The preview remounts, so the report is opened again.
		expect(mocks.open).toHaveBeenCalledTimes(2)
	})

	it("keeps the desktop preview pane on desktop", () => {
		mocks.isMobile = false
		render(<ResearchReportPane generating={false} />)
		expect(mocks.detailMounted).toBeGreaterThan(0)
		expect(mocks.popupProps).toHaveLength(0)
	})
})
