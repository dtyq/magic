import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ServiceProviderModel } from "@/apis/modules/org-ai-model-provider"
import { MyModelRow } from "./MyModelRow"
import type { MyModelGroup } from "./utils"

const { user } = vi.hoisted(() => ({
	user: {
		isPersonalOrganization: false,
		isAdmin: false,
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/models/user", () => ({
	userStore: { user },
}))

vi.mock("@/components/base", () => ({
	MagicDropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/services/superMagic/SuperMagicCustomModelService", () => ({
	serviceProviderModelToModelItem: (model: ServiceProviderModel) => ({
		model_id: model.model_id,
	}),
}))

vi.mock("../ProviderTypeIcon", () => ({
	ProviderTypeIcon: () => null,
}))

const model: ServiceProviderModel = {
	id: "model-1",
	name: "Test model",
	model_id: "test-model",
	model_version: "test-model",
	model_type: 5,
	category: "vgm",
	description: "A test video model",
	service_provider_config_id: "provider-1",
	service_provider_config: {
		id: "provider-1",
		name: "Custom provider",
	},
}

const group: MyModelGroup = {
	representativeModel: model,
	providerEntries: [
		{
			model,
			provider: null,
			providerAlias: "",
			providerName: "Custom provider",
			providerTypeName: "",
		},
	],
}

describe("MyModelRow", () => {
	beforeEach(() => {
		user.isPersonalOrganization = false
		user.isAdmin = false
	})

	it("hides model actions for enterprise administrators", () => {
		user.isAdmin = true

		render(<MyModelRow group={group} onEdit={vi.fn()} onDelete={vi.fn()} />)

		expect(screen.queryByTestId("my-model-actions-model-1")).not.toBeInTheDocument()
	})

	it("keeps model actions for personal organizations", () => {
		user.isPersonalOrganization = true

		render(<MyModelRow group={group} onEdit={vi.fn()} onDelete={vi.fn()} />)

		expect(screen.getByTestId("my-model-actions-model-1")).toBeInTheDocument()
	})

	describe("compact desktop row", () => {
		it("keeps the description out of the row and marks the selection with a check column", () => {
			const onSelect = vi.fn()
			render(
				<MyModelRow
					group={group}
					isSelected
					onSelect={onSelect}
					onEdit={vi.fn()}
					onDelete={vi.fn()}
					compact
				/>,
			)

			const row = screen.getByTestId("my-model-item-model-1")
			expect(row).toHaveTextContent("Test model")
			expect(row).not.toHaveTextContent("A test video model")
			expect(row).toHaveAttribute("aria-pressed", "true")
			expect(row.querySelector("svg")).toBeTruthy()
			expect(screen.queryByRole("checkbox")).toBeNull()

			fireEvent.keyDown(row, { key: "Enter" })
			expect(onSelect).toHaveBeenCalledWith({ model_id: "test-model" })
		})

		it("hides provider and actions for enterprise organizations", () => {
			render(<MyModelRow group={group} onEdit={vi.fn()} onDelete={vi.fn()} compact />)

			expect(screen.queryByTestId("my-model-provider-badge-model-1")).toBeNull()
			expect(screen.queryByTestId("my-model-actions-model-1")).toBeNull()
		})

		it("shows the provider in the multiplier slot and keeps actions for personal organizations", () => {
			user.isPersonalOrganization = true

			render(<MyModelRow group={group} onEdit={vi.fn()} onDelete={vi.fn()} compact />)

			expect(screen.getByTestId("my-model-provider-badge-model-1")).toHaveTextContent(
				"Custom provider",
			)
			expect(screen.getByTestId("my-model-actions-model-1")).toBeInTheDocument()
		})
	})
})
