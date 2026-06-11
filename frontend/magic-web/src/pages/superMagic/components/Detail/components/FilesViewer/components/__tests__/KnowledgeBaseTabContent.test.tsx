import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { KnowledgeApi } from "@/apis"
import { KnowledgeFileService } from "@/services/file/KnowledgeFile"
import KnowledgeBaseTabContent from "../KnowledgeBaseTabContent"

const tMock = vi.hoisted(
	() => (_key: string, defaultValueOrOptions?: string | Record<string, unknown>) =>
		typeof defaultValueOrOptions === "string" ? defaultValueOrOptions : _key,
)

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
	useTranslation: () => ({
		t: tMock,
	}),
}))

vi.mock("antd", () => ({
	App: Object.assign(({ children }: { children?: React.ReactNode }) => <>{children}</>, {
		useApp: () => ({
			message: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
			modal: {},
			notification: {},
		}),
	}),
	Flex: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
	Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/apis", () => ({
	KnowledgeApi: {
		getKnowledgeSourceFileLink: vi.fn(),
	},
}))

vi.mock("@/services/file/KnowledgeFile", () => ({
	KnowledgeFileService: {
		fetchFileUrl: vi.fn(),
	},
}))

vi.mock("@/components/base", () => ({
	MagicSpin: () => <div data-testid="loading" />,
	MagicPdfRender: ({ file }: { file: string }) => <div data-testid="pdf-preview">{file}</div>,
	MagicImagePreview: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="image-preview">{children}</div>
	),
}))

vi.mock("@/components/UniverComponent", () => ({
	default: ({ data }: { data: File }) => (
		<div data-testid="sheet-preview">{data instanceof File ? data.name : "sheet"}</div>
	),
}))

vi.mock("@/components/base/MagicDocxRender", () => ({
	default: ({ file }: { file: File }) => <div data-testid="docx-preview">{file.name}</div>,
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	downloadFileContent: vi.fn(),
}))

vi.mock("../../../ContentRenderer", () => ({
	default: () => <div data-testid="legacy-content-renderer" />,
}))

vi.mock("../../../../contents/OnlyOffice", () => ({
	default: ({
		data,
		file_extension,
		showFileHeader,
	}: {
		data: { file_url?: string }
		file_extension?: string
		showFileHeader?: boolean
	}) => (
		<div data-testid="onlyoffice-preview">
			{data.file_url}|{file_extension}|{String(showFileHeader)}
		</div>
	),
}))

describe("KnowledgeBaseTabContent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders a source-link PDF URL directly without falling back to fileKey URL lookup", async () => {
		vi.mocked(KnowledgeApi.getKnowledgeSourceFileLink).mockResolvedValue({
			data: {
				available: true,
				fileUrl: "https://example.com/source.pdf",
				name: "source.pdf",
				link_type: "download",
			},
		} as any)

		render(
			<KnowledgeBaseTabContent
				data={{
					knowledgeBaseId: "KNOWLEDGE-1",
					documentCode: "doc-1",
					fileKey: "DT001/source.pdf",
					title: "source.pdf",
					knowledgeBaseName: "技术知识库",
				}}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("pdf-preview")).toHaveTextContent(
				"https://example.com/source.pdf",
			)
		})

		expect(KnowledgeApi.getKnowledgeSourceFileLink).toHaveBeenCalledWith({
			knowledgeBaseCode: "KNOWLEDGE-1",
			documentCode: "doc-1",
			fileKey: "DT001/source.pdf",
		})
		expect(KnowledgeFileService.fetchFileUrl).not.toHaveBeenCalled()
	})

	it("routes DOC source links to the readonly OnlyOffice branch with direct file_url", async () => {
		vi.mocked(KnowledgeApi.getKnowledgeSourceFileLink).mockResolvedValue({
			data: {
				available: true,
				fileUrl: "https://example.com/source.doc",
				name: "source.doc",
				link_type: "download",
			},
		} as any)

		render(
			<KnowledgeBaseTabContent
				data={{
					knowledgeBaseId: "KNOWLEDGE-1",
					documentCode: "doc-1",
					fileKey: "DT001/source.doc",
					title: "source.doc",
					knowledgeBaseName: "技术知识库",
				}}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("onlyoffice-preview")).toHaveTextContent(
				"https://example.com/source.doc|doc|false",
			)
		})

		expect(KnowledgeFileService.fetchFileUrl).not.toHaveBeenCalled()
	})
})
