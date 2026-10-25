import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import EditCrewDialog from "../EditCrewDialog"

const mockStore = {
	crewCode: "crew-1",
	identity: {
		icon: null,
		name_i18n: { default: "Crew Name", en_US: "Crew Name", zh_CN: "员工名称" },
		role_i18n: { default: ["Analyst"], en_US: ["Analyst"], zh_CN: ["分析师"] },
		description_i18n: {
			default: "Crew description",
			en_US: "Crew description",
			zh_CN: "员工描述",
		},
	},
	refreshAgentDetail: vi.fn(),
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"editCrew.viewTitle": "员工详情",
				"editCrew.title": "编辑员工",
				"editCrew.buttons.close": "关闭",
				"editCrew.buttons.cancel": "取消",
				"editCrew.buttons.confirm": "保存",
				"editCrew.actions.upload": "上传",
				"editCrew.fields.avatar": "头像",
				"card.localizeDialog.tabName": "名称",
				"card.localizeDialog.tabRole": "角色",
				"card.localizeDialog.tabDescription": "描述",
				"card.localizeDialog.title": "多语言",
				"card.enterName": "请输入名称",
				"card.enterRole": "请输入角色",
				"card.enterDescription": "请输入描述",
				"playbook.edit.basicInfo.localeDialog.localeLabels.en_US": "English",
				"playbook.edit.basicInfo.localeDialog.localeLabels.zh_CN": "简体中文",
			})[key] ?? key,
		i18n: { language: "zh_CN" },
	}),
}))

vi.mock("@/hooks/useUploadFiles", () => ({
	useUpload: () => ({ upload: vi.fn() }),
}))

vi.mock("@/apis", () => ({
	FileApi: {
		reportFileUploads: vi.fn(),
		getFileUrl: vi.fn(),
	},
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: { updateAgentInfo: vi.fn() },
}))

vi.mock("@/pages/superMagic/pages/CrewEdit/context", () => ({
	useCrewEditStore: () => mockStore,
}))

describe("EditCrewDialog", () => {
	it("renders viewer details without write controls", () => {
		const onOpenChange = vi.fn()

		render(<EditCrewDialog open readOnly onOpenChange={onOpenChange} />)

		expect(screen.getByText("员工详情")).toBeInTheDocument()
		expect(screen.getByTestId("edit-crew-name-input")).toHaveAttribute("readonly")
		expect(screen.getByTestId("edit-crew-role-input")).toHaveAttribute("readonly")
		expect(screen.getByTestId("edit-crew-description-input")).toHaveAttribute("readonly")
		expect(screen.queryByTestId("edit-crew-avatar-upload-button")).not.toBeInTheDocument()
		expect(screen.queryByTestId("edit-crew-confirm-button")).not.toBeInTheDocument()
		expect(screen.getByTestId("edit-crew-cancel-button")).toHaveTextContent("关闭")

		const nameInput = screen.getByTestId("edit-crew-name-input")
		fireEvent.change(nameInput, { target: { value: "Changed Name" } })
		expect(nameInput).toHaveValue("Crew Name")

		fireEvent.click(screen.getByTestId("edit-crew-cancel-button"))
		expect(onOpenChange).toHaveBeenCalledWith(false)
	})

	it("keeps edit controls for normal users", () => {
		render(<EditCrewDialog open onOpenChange={vi.fn()} />)

		expect(screen.getByText("编辑员工")).toBeInTheDocument()
		expect(screen.getByTestId("edit-crew-avatar-upload-button")).toBeInTheDocument()
		expect(screen.getByTestId("edit-crew-confirm-button")).toHaveTextContent("保存")
		expect(screen.getByTestId("edit-crew-name-input")).not.toHaveAttribute("readonly")
	})
})
