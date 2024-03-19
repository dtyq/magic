import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { SceneItem } from "../../../types"
import { SceneEditStore, SceneEditStoreContext } from "../store"
import { BasicInfoPanel } from "../panels/BasicInfoPanel"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../components/IconPickerPanel", () => ({
	IconPickerPanel: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../components/ColorPickerPopover", () => ({
	ColorPickerPopover: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("../components/LocaleTextInput", () => ({
	LocaleTextInput: ({
		value,
		onChange,
		multiline,
		"data-testid": testId,
	}: {
		value: { default?: string } | string
		onChange: (nextValue: { default?: string } | string) => void
		multiline?: boolean
		"data-testid"?: string
	}) => {
		const resolvedValue = typeof value === "string" ? value : (value.default ?? "")

		const handleChange = (nextValue: string) => {
			if (typeof value === "string") {
				onChange(nextValue)
				return
			}
			onChange({ ...value, default: nextValue })
		}

		if (multiline) {
			return (
				<textarea
					data-testid={testId}
					value={resolvedValue}
					onChange={(event) => handleChange(event.target.value)}
				/>
			)
		}

		return (
			<input
				data-testid={testId}
				value={resolvedValue}
				onChange={(event) => handleChange(event.target.value)}
			/>
		)
	},
}))

vi.mock("@/opensource/utils/lucideIconLoader", () => ({
	LucideLazyIcon: () => <span data-testid="mock-scene-icon" />,
}))

function createScene(): SceneItem {
	return {
		id: "scene-1",
		name: {
			default: "Original scene",
			zh_CN: "原始场景",
			en_US: "Original scene",
		},
		description: {
			default: "Original description",
			zh_CN: "原始描述",
			en_US: "Original description",
		},
		icon: "Circle",
		theme_color: "#6366f1",
		enabled: true,
		update_at: new Date().toISOString(),
	}
}

function renderPanel(store: SceneEditStore) {
	return render(
		<SceneEditStoreContext.Provider value={store}>
			<BasicInfoPanel />
		</SceneEditStoreContext.Provider>,
	)
}

describe("BasicInfoPanel", () => {
	it("keeps saved basic info when the panel is mounted again", async () => {
		const handleSave = vi.fn().mockResolvedValue(undefined)
		const store = new SceneEditStore(createScene(), handleSave)

		const firstRender = renderPanel(store)

		fireEvent.change(screen.getByTestId("basic-info-name-input"), {
			target: { value: "Updated scene" },
		})
		fireEvent.click(screen.getByTestId("basic-info-save-button"))

		await waitFor(() => {
			expect(handleSave).toHaveBeenCalledTimes(1)
		})

		expect(store.scene.name).toEqual({
			default: "Updated scene",
			zh_CN: "原始场景",
			en_US: "Original scene",
		})

		firstRender.unmount()
		renderPanel(store)

		expect(screen.getByTestId("basic-info-name-input")).toHaveValue("Updated scene")
	})
})
