import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { handleAttachmentDragStart } from "@/pages/superMagic/components/MessageEditor/utils/drag"
import type { SendMessageByContentPayload } from "@/pages/superMagic/components/MessageEditor/types"

import MicroAppSkillsWorkspace from "../MicroAppSkillsWorkspace"

const { loadProjectSkillsMock, saveFileContentMock } = vi.hoisted(() => ({
	loadProjectSkillsMock: vi.fn(),
	saveFileContentMock: vi.fn(),
}))

vi.mock("@/pages/superMagic/contexts/HostConversationContext", () => ({
	useHostConversation: () => ({ selectedProject: { id: "project-1" } }),
}))
vi.mock("@/pages/superMagic/components/MessageEditor/utils/drag", () => ({
	handleAttachmentDragStart: vi.fn(),
	handleTabDragEnd: vi.fn(),
}))
vi.mock("@/pages/superMagic/pages/SkillEdit/utils/skill-workspace-manifest", () => ({
	parseSkillDirFromSkillMdRelativePath: (path: string) =>
		path.split(".magic/skills/")[1]?.replace(/\/SKILL.md$/, "") || null,
	normalizeRelativeFilePath: (path?: string) => path?.replace(/\/$/, "") || "",
}))
vi.mock("@/pages/superMagic/fileAccess/fileApi", () => ({ useFileApi: () => fileApi }))
const fileApi = {}

vi.mock("@/pages/superMagic/components/microAppSkills", () => ({
	loadProjectSkills: loadProjectSkillsMock,
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: { saveFileContent: saveFileContentMock },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/pages/superMagic/components/Detail/contents/Md/components/EditorBody", () => ({
	default: ({
		content,
		isEditMode,
		setEditContent,
		...props
	}: {
		content: string
		isEditMode?: boolean
		setEditContent?: (value: string) => void
		[key: string]: unknown
	}) =>
		isEditMode ? (
			<textarea
				value={content}
				onChange={(event) => setEditContent?.(event.target.value)}
				data-testid="micro-app-skill-editor"
				data-view-mode={props.viewMode as string}
			/>
		) : (
			<pre data-testid={props["data-testid"] as string}>{content}</pre>
		),
}))

vi.mock("@/pages/superMagic/components/Detail/contents/Md", () => ({
	default: ({ data, isEditMode }: { data?: { content?: string }; isEditMode?: boolean }) => (
		<pre data-testid="micro-app-skill-markdown" data-edit-mode={String(isEditMode)}>
			{data?.content}
		</pre>
	),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"microAppPage.skills.contentEmpty": "暂无内容",
				"microAppPage.skills.cancel": "取消",
				"microAppPage.skills.detailEmpty": "请选择技能",
				"microAppPage.skills.edit": "编辑",
				"microAppPage.skills.empty": "暂无技能",
				"microAppPage.skills.loadFailed": "加载失败",
				"microAppPage.skills.loading": "加载中",
				"microAppPage.skills.noDescription": "暂无描述",
				"microAppPage.skills.save": "保存",
				"microAppPage.skills.saveFailed": "保存失败",
				"microAppPage.skills.saveSuccess": "已保存",
				"microAppPage.skills.saving": "保存中",
				"microAppPage.skills.title": "项目技能",
				"microAppPage.skills.workspaceSubtitle": "查看技能文件",
			})[key] ?? key,
		i18n: { language: "zh_CN", resolvedLanguage: "zh_CN" },
	}),
}))

describe("MicroAppSkillsWorkspace", () => {
	beforeEach(() => {
		saveFileContentMock.mockResolvedValue(undefined)
		loadProjectSkillsMock.mockResolvedValue([
			{
				id: "skill-1",
				directory: "data",
				name: "数据助手",
				description: "分析项目数据",
				content: "# 数据助手\n\n详细说明",
			},
		])
	})

	it("lists skills and shows the selected SKILL.md content", async () => {
		render(<MicroAppSkillsWorkspace attachmentList={[]} canEdit />)

		expect(await screen.findByText("数据助手")).toBeInTheDocument()
		expect(screen.getByText("分析项目数据")).toBeInTheDocument()
		expect(screen.getByText("请选择技能")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("micro-app-skill-workspace-item-skill-1"))
		expect(screen.getAllByText("数据助手")).toHaveLength(2)
		expect(screen.getAllByText("分析项目数据")).toHaveLength(2)
		expect(screen.getByTestId("micro-app-skill-content")).toHaveTextContent("# 数据助手")
		expect(screen.getByTestId("micro-app-skill-markdown")).toHaveAttribute(
			"data-edit-mode",
			"false",
		)
		expect(screen.getByText("SKILL.md")).toBeInTheDocument()
		expect(screen.getByTestId("micro-app-skills-workspace")).toBeInTheDocument()
	})

	it("allows editing and saving the complete SKILL.md source", async () => {
		render(<MicroAppSkillsWorkspace attachmentList={[]} canEdit />)
		await screen.findByText("数据助手")
		fireEvent.click(screen.getByTestId("micro-app-skill-workspace-item-skill-1"))
		fireEvent.click(screen.getByRole("button", { name: /编辑/ }))
		const editor = screen.getByTestId("micro-app-skill-editor")
		expect(editor).toHaveAttribute("data-view-mode", "markdown")
		fireEvent.change(editor, { target: { value: "---\nname: data\n---\n# 更新" } })
		fireEvent.click(screen.getByRole("button", { name: /保存/ }))
		await waitFor(() => {
			expect(saveFileContentMock).toHaveBeenCalledWith([
				{ file_id: "skill-1", content: "---\nname: data\n---\n# 更新" },
			])
		})
	})
})

describe("skill creation and folder references", () => {
	it("shows a centered creation fallback only for an empty editable list", async () => {
		loadProjectSkillsMock.mockResolvedValue([])
		const { rerender } = render(<MicroAppSkillsWorkspace attachmentList={[]} canEdit />)
		expect(await screen.findByText("暂无技能")).toBeInTheDocument()
		expect(screen.getAllByRole("button", { name: "microAppPage.skills.create" })).toHaveLength(
			2,
		)
		await act(async () => rerender(<MicroAppSkillsWorkspace attachmentList={[]} />))
		expect(
			screen.queryByRole("button", { name: "microAppPage.skills.create" }),
		).not.toBeInTheDocument()
	})
	it("retains requirements after rejection and sends once while pending", async () => {
		loadProjectSkillsMock.mockResolvedValue([])
		const requests: SendMessageByContentPayload[] = []
		const listener = (request: SendMessageByContentPayload) => {
			if (request.tryClaim?.()) requests.push(request)
		}
		pubsub.subscribe(PubSubEvents.Send_Message_by_Content, listener)
		try {
			render(<MicroAppSkillsWorkspace attachmentList={[]} canEdit />)
			fireEvent.click(
				screen.getAllByRole("button", { name: "microAppPage.skills.create" })[0],
			)
			const submit = screen.getByRole("button", { name: "microAppPage.skills.createSubmit" })
			expect(submit).toBeDisabled()
			const input = screen.getByRole("textbox")
			fireEvent.change(input, { target: { value: "整理行业热点" } })
			fireEvent.click(submit)
			fireEvent.click(submit)
			expect(requests).toHaveLength(1)
			expect(requests[0]).toMatchObject({
				targetProjectId: "project-1",
				shouldClearEditorAfterSend: false,
			})
			await act(async () => requests[0].onHandled?.(false))
			expect(await screen.findByRole("alert")).toBeInTheDocument()
			expect(input).toHaveValue("整理行业热点")
			fireEvent.click(submit)
			expect(requests).toHaveLength(2)
			await act(async () => requests[1].onHandled?.(true))
			await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
		} finally {
			pubsub.unsubscribe(PubSubEvents.Send_Message_by_Content, listener)
		}
	})
	it.each([false, true])(
		"uses the actual folder identity for drag and add-to-conversation (nested: %s)",
		async (nested) => {
			loadProjectSkillsMock.mockResolvedValue([
				{ id: "manifest", directory: "data", name: "Data", content: "# Data" },
			])
			const publish = vi.spyOn(pubsub, "publish")
			const folder = {
				file_id: "folder",
				file_name: "data",
				is_directory: true,
				relative_file_path: ".magic/skills/data/",
				children: [{ file_id: "nested" }],
			}
			const attachmentList = nested
				? [
						{
							is_directory: true,
							relative_file_path: ".magic",
							children: [
								{
									file_id: "skills-root",
									type: "directory",
									relative_file_path: ".magic/skills",
									children: [folder],
								},
							],
						},
					]
				: [folder]
			render(<MicroAppSkillsWorkspace canEdit attachmentList={attachmentList} />)

			const item = await screen.findByTestId("micro-app-skill-workspace-item-manifest")
			expect(item).toHaveAttribute("draggable", "true")
			fireEvent.dragStart(item, { dataTransfer: { effectAllowed: "none" } })
			expect(handleAttachmentDragStart).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ file_id: "folder", is_directory: true }),
				expect.objectContaining({
					type: "project_directory",
					data: expect.objectContaining({
						directory_id: "folder",
						directory_path: ".magic/skills/data",
					}),
				}),
			)
			const payload = vi.mocked(handleAttachmentDragStart).mock.calls.at(-1)?.[1]
			expect(payload).not.toHaveProperty("children")
			fireEvent.click(item)
			fireEvent.click(
				screen.getByRole("button", { name: "microAppPage.skills.addToConversation" }),
			)
			expect(publish).toHaveBeenCalledWith(
				PubSubEvents.Add_File_To_Chat,
				expect.objectContaining({
					items: [
						expect.objectContaining({
							type: "project_directory",
							data: expect.objectContaining({
								directory_id: "folder",
								project_id: "project-1",
							}),
						}),
					],
				}),
			)
			publish.mockRestore()
		},
	)
})
