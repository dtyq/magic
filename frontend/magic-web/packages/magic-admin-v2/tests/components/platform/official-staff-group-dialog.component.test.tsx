import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import {
	DynamicModelEditDialog,
	GroupFormDialog,
} from "../../../src/features/platform-official-staff/components/assignment/assignment-dialogs"
import { createDynamicModel } from "../../../src/features/platform-official-staff/utils/assignment-models"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@magic-admin-v2/features/platform-official-staff/mutations", () => ({
	useSaveOfficialStaffGroupMutation: () => ({
		isPending: false,
		mutateAsync: vi.fn(),
	}),
}))

vi.mock(
	"@magic-admin-v2/features/platform-official-staff/components/staff-icon-upload-field",
	() => ({
		StaffIconUploadField: () => <div data-testid="icon-upload" />,
	}),
)

function expectFieldError(fieldId: string, message: string) {
	const field = document.querySelector(`[data-form-field="${fieldId}"]`)
	expect(field).not.toBeNull()
	expect(within(field as HTMLElement).getByText(message)).toBeInTheDocument()
}

it("shows required group name validation beneath both fields", async () => {
	render(
		<GroupFormDialog
			canEdit
			category="text"
			detail={null}
			onChange={vi.fn()}
			onOpenChange={vi.fn()}
			open
			pendingModel={null}
			targetGroup={null}
		/>,
	)

	fireEvent.click(screen.getByRole("button", { name: "common.save" }))

	await waitFor(() => {
		expectFieldError(
			"official-staff-group-name-zh",
			"officialStaff.validation.groupNameZhRequired",
		)
		expectFieldError(
			"official-staff-group-name-en",
			"officialStaff.validation.groupNameEnRequired",
		)
	})
})

it("shows required dynamic model name validation beneath both fields", async () => {
	const model = createDynamicModel("group-1", 0)
	model.model_name = ""
	model.model_translate.name = { en_US: "", zh_CN: "" }
	const onSave = vi.fn()

	render(
		<DynamicModelEditDialog
			canEdit
			model={model}
			onOpenChange={vi.fn()}
			onSave={onSave}
			open
		/>,
	)

	fireEvent.click(screen.getByRole("button", { name: "common.save" }))

	await waitFor(() => {
		expectFieldError(
			"official-staff-model-name-zh",
			"officialStaff.validation.dynamicModelNameZhRequired",
		)
	})

	fireEvent.click(screen.getByRole("tab", { name: /language.enUS/ }))

	await waitFor(() => {
			expectFieldError(
				"official-staff-model-name-en",
				"officialStaff.validation.dynamicModelNameEnRequired",
			)
	})
	expect(onSave).not.toHaveBeenCalled()
})
