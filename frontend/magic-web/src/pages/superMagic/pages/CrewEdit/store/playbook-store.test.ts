import { describe, expect, it, vi, beforeEach } from "vitest"
import type { SceneItem } from "../components/StepDetailPanel/PlaybookPanel/types"
import { CrewPlaybookStore } from "./playbook-store"

const { updatePlaybookMock } = vi.hoisted(() => ({
	updatePlaybookMock: vi.fn(),
}))

vi.mock("@/apis/modules/crew", () => ({
	buildCrewI18nText: (value: string) => ({
		default: value,
		zh_CN: value,
		en_US: value,
	}),
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		getPlaybooks: vi.fn(),
		togglePlaybookEnabled: vi.fn(),
		deletePlaybook: vi.fn(),
		reorderPlaybooks: vi.fn(),
		createPlaybook: vi.fn(),
		updatePlaybook: updatePlaybookMock,
	},
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

describe("CrewPlaybookStore.updateScene", () => {
	beforeEach(() => {
		updatePlaybookMock.mockReset()
		updatePlaybookMock.mockResolvedValue([])
	})

	it("replaces the list item reference after save", async () => {
		const store = new CrewPlaybookStore({
			getCrewCode: () => "crew-1",
			markCrewUpdated: vi.fn(),
		})
		const scene = createScene()
		store.scenes = [scene]
		store.playbookIdMap.set(scene.id, scene.id)

		scene.name = {
			default: "Updated scene",
			zh_CN: "更新后的场景",
			en_US: "Updated scene",
		}

		await store.updateScene(scene)

		expect(store.scenes[0]).not.toBe(scene)
		expect(store.scenes[0]?.name).toEqual(scene.name)
		expect(updatePlaybookMock).toHaveBeenCalledTimes(1)
	})
})
