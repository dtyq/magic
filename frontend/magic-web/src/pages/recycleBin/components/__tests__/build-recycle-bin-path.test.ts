import { describe, expect, it } from "vitest"
import {
	buildRecycleBinPathLabel,
	RESOURCE_TYPE,
} from "@/pages/recycleBin/components/recycle-bin-domain"

const FALLBACK = {
	"common.unNamedWorkspace": "未命名工作区",
	"common.untitledProject": "未命名项目",
	"mobile.recycleBin.pathScopes.workspaces": "工作空间",
} as const

/** Minimal i18n mock with literal keys for path builder tests. */
function createPathT() {
	return ((key: string) => FALLBACK[key as keyof typeof FALLBACK] ?? key) as never
}

describe("buildRecycleBinPathLabel", () => {
	const t = createPathT()

	it("shows workspaces scope only for deleted workspace", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.WORKSPACE,
				parentInfo: undefined,
				t,
			}),
		).toBe("工作空间")
	})

	it("shows scope and workspace name for deleted project", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.PROJECT,
				parentInfo: { workspace_name: "Growth" },
				t,
			}),
		).toBe("工作空间 / Growth")
	})

	it("uses default workspace name when parent_info is missing for project", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.PROJECT,
				parentInfo: undefined,
				t,
			}),
		).toBe("工作空间 / 未命名工作区")
	})

	it("shows scope, workspace, and project for deleted topic", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.TOPIC,
				parentInfo: {
					workspace_name: "Engineering",
					project_name: "Backend Refactor",
				},
				t,
			}),
		).toBe("工作空间 / Engineering / Backend Refactor")
	})

	it("fills missing workspace segment with default name for topic", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.TOPIC,
				parentInfo: { project_name: "Backend Refactor" },
				t,
			}),
		).toBe("工作空间 / 未命名工作区 / Backend Refactor")
	})

	it("fills both parent segments when parent_info names are empty for topic", () => {
		expect(
			buildRecycleBinPathLabel({
				resourceType: RESOURCE_TYPE.TOPIC,
				parentInfo: { workspace_name: "", project_name: "  " },
				t,
			}),
		).toBe("工作空间 / 未命名工作区 / 未命名项目")
	})
})
