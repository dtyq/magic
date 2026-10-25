import { FileAccessProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import {
	cloneElement,
	createContext,
	isValidElement,
	useContext,
	type ReactElement,
	type ReactNode,
} from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import MicroAppSkillsPanel from "../MicroAppSkillsPanel"

const { getFileContentsByIdsMock, publishMock } = vi.hoisted(() => ({
	getFileContentsByIdsMock: vi.fn(),
	publishMock: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentsByIds: getFileContentsByIdsMock,
}))

vi.mock("@/utils/pubsub", () => ({
	default: { publish: publishMock },
	PubSubEvents: { Append_Suggestion_To_Editor: "Append_Suggestion_To_Editor" },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: { skill?: string }) => {
			if (key === "microAppPage.skills.usePrompt") return `使用 ${options?.skill} 技能`
			if (key === "microAppPage.conversation.defaultAppName") return "微应用"
			return (
				{
					"microAppPage.skills.empty": "当前项目暂无技能",
					"microAppPage.skills.loading": "正在加载技能...",
					"microAppPage.skills.noDescription": "暂无描述",
					"microAppPage.skills.loadFailed": "技能加载失败",
					"microAppPage.skills.subtitle": "选择技能",
					"microAppPage.skills.title": "项目技能",
					"microAppPage.skills.trigger": "技能",
					"microAppPage.skills.use": "使用",
				}[key] ?? key
			)
		},
		i18n: { language: "zh_CN", resolvedLanguage: "zh_CN" },
	}),
}))

vi.mock("@/components/shadcn-ui/popover", () => {
	const PopoverContext = createContext<{
		open: boolean
		onOpenChange: (open: boolean) => void
	} | null>(null)

	return {
		Popover: ({
			children,
			open,
			onOpenChange,
		}: {
			children: ReactNode
			open: boolean
			onOpenChange: (open: boolean) => void
		}) => (
			<PopoverContext.Provider value={{ open, onOpenChange }}>
				{children}
			</PopoverContext.Provider>
		),
		PopoverTrigger: ({ children }: { children: ReactNode }) => {
			const context = useContext(PopoverContext)
			if (!context || !isValidElement(children)) return children
			return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
				onClick: () => context.onOpenChange(true),
			})
		},
		PopoverContent: ({ children }: { children: ReactNode }) => {
			const context = useContext(PopoverContext)
			return context?.open ? <div>{children}</div> : null
		},
	}
})

describe("MicroAppSkillsPanel", () => {
	beforeEach(() => {
		getFileContentsByIdsMock.mockReset()
		publishMock.mockReset()
		getFileContentsByIdsMock.mockResolvedValue({
			successes: new Map([
				[
					"skill-1",
					"---\nname: Data helper\nname-cn: 数据助手\ndescription: Analyze data\ndescription-cn: 分析项目数据\n---\n",
				],
			]),
			failures: new Map(),
		})
	})

	it("loads project skill metadata and appends the selected skill prompt", async () => {
		render(
			<FileAccessProvider
				value={createShareFileAccess({ token: "share-token", projectId: "source-project" })}
			>
				<MicroAppSkillsPanel
					microAppId="app-1"
					microAppName="客户跟进助手"
					attachmentList={[
						{ file_id: "skill-1", relative_file_path: ".magic/skills/data/SKILL.md" },
					]}
				/>
			</FileAccessProvider>,
		)

		fireEvent.click(screen.getByTestId("micro-app-skills-trigger"))
		expect(await screen.findByText("数据助手")).toBeInTheDocument()
		expect(screen.getByText("分析项目数据")).toBeInTheDocument()
		expect(getFileContentsByIdsMock).toHaveBeenCalledWith(
			["skill-1"],
			expect.objectContaining({
				access: { kind: "share", token: "share-token", projectId: "source-project" },
			}),
		)

		fireEvent.click(screen.getByTestId("micro-app-skill-use-skill-1"))
		expect(publishMock).toHaveBeenCalledWith(
			"Append_Suggestion_To_Editor",
			expect.objectContaining({
				type: "doc",
				content: [
					expect.objectContaining({
						content: [
							expect.objectContaining({
								type: "mention",
								attrs: {
									type: "micro_app",
									data: { app_id: "app-1", app_name: "客户跟进助手" },
								},
							}),
							expect.objectContaining({ type: "text", text: "使用 数据助手 技能" }),
						],
					}),
				],
			}),
		)
	})
	it("shows a load error when a manifest fails to download", async () => {
		getFileContentsByIdsMock.mockResolvedValue({
			successes: new Map(),
			failures: new Map([["skill-1", new Error("Forbidden")]]),
		})
		render(
			<MicroAppSkillsPanel
				microAppId="app-1"
				attachmentList={[
					{ file_id: "skill-1", relative_file_path: ".magic/skills/data/SKILL.md" },
				]}
			/>,
		)
		fireEvent.click(screen.getByTestId("micro-app-skills-trigger"))
		expect(await screen.findByText("技能加载失败")).toBeInTheDocument()
		expect(screen.queryByTestId("micro-app-skill-use-skill-1")).not.toBeInTheDocument()
	})
})
