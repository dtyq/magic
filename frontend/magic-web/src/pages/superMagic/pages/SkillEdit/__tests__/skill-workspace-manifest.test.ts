import { describe, expect, it } from "vitest"
import { SupportLocales } from "@/constants/locale"
import {
	buildDefaultSkillConfigYaml,
	buildDefaultSlotUpdateParams,
	buildSkillMdRelativePath,
	findAttachmentByRelativePath,
	findDirectoryIdByRelativePath,
	findDirectoryIdBySegmentWalk,
	getAttachmentUpdatedAtMs,
	matchesRelativePath,
	normalizeRelativeFilePath,
	parseSkillConfigYaml,
	parseSkillDirFromSkillMdRelativePath,
	parseSkillMdFrontmatter,
	pickLastModifiedSkillDirWithSkillMd,
	SKILL_CONFIG_RELATIVE_PATH,
} from "../utils/skill-workspace-manifest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { AttachmentSource } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

type SkillDetailForPatch = Parameters<typeof buildDefaultSlotUpdateParams>[0]

function minimalSkillDetail(overrides: Partial<SkillDetailForPatch> = {}): SkillDetailForPatch {
	return {
		name_i18n: {
			[SupportLocales.fallback]: "",
			[SupportLocales.enUS]: "",
			[SupportLocales.zhCN]: "",
		},
		description_i18n: {
			[SupportLocales.fallback]: "",
			[SupportLocales.enUS]: "",
			[SupportLocales.zhCN]: "",
		},
		...overrides,
	}
}

describe("normalizeRelativeFilePath", () => {
	it("normalizes slashes and leading ./", () => {
		expect(normalizeRelativeFilePath(".\\.magic\\skills\\a.yaml")).toBe(".magic/skills/a.yaml")
		expect(normalizeRelativeFilePath("./foo/bar")).toBe("foo/bar")
	})

	it("strips leading slash", () => {
		expect(normalizeRelativeFilePath("/.magic/skills")).toBe(".magic/skills")
	})

	it("strips trailing slash (API directory paths)", () => {
		expect(normalizeRelativeFilePath("/.magic/")).toBe(".magic")
		expect(normalizeRelativeFilePath("/.magic/skills/")).toBe(".magic/skills")
	})
})

describe("matchesRelativePath", () => {
	it("matches exact or suffix path", () => {
		expect(
			matchesRelativePath(".magic/skills/skill_config.yaml", SKILL_CONFIG_RELATIVE_PATH),
		).toBe(true)
		expect(
			matchesRelativePath("x/.magic/skills/skill_config.yaml", SKILL_CONFIG_RELATIVE_PATH),
		).toBe(true)
		expect(matchesRelativePath(".magic/skills/other.yaml", SKILL_CONFIG_RELATIVE_PATH)).toBe(
			false,
		)
	})
})

describe("buildSkillMdRelativePath", () => {
	it("builds path under .magic/skills", () => {
		expect(buildSkillMdRelativePath("my-skill")).toBe(".magic/skills/my-skill/SKILL.md")
		expect(buildSkillMdRelativePath("/nested/dir/")).toBe(".magic/skills/nested/dir/SKILL.md")
	})
})

describe("findAttachmentByRelativePath", () => {
	it("finds file by relative_file_path", () => {
		const list: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "f1",
				relative_file_path: ".magic/skills/skill_config.yaml",
			},
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				is_directory: true,
				relative_file_path: ".magic/skills",
			},
		]
		const found = findAttachmentByRelativePath(list, SKILL_CONFIG_RELATIVE_PATH)
		expect(found?.file_id).toBe("f1")
	})
})

describe("buildDefaultSkillConfigYaml", () => {
	it("writes skill.dir for fallback config", () => {
		const yaml = buildDefaultSkillConfigYaml("default")
		expect(parseSkillConfigYaml(yaml)).toBe("default")
	})
})

describe("parseSkillDirFromSkillMdRelativePath", () => {
	it("parses dir from standard path", () => {
		expect(parseSkillDirFromSkillMdRelativePath(".magic/skills/my-skill/SKILL.md")).toBe(
			"my-skill",
		)
	})

	it("parses embedded .magic/skills path", () => {
		expect(parseSkillDirFromSkillMdRelativePath("x/.magic/skills/foo/SKILL.md")).toBe("foo")
	})

	it("accepts case-insensitive skill.md filename", () => {
		expect(parseSkillDirFromSkillMdRelativePath(".magic/skills/foo/skill.md")).toBe("foo")
	})
})

describe("findDirectoryIdByRelativePath", () => {
	it("returns file_id for directory path", () => {
		const list: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "dir-1",
				is_directory: true,
				relative_file_path: ".magic/skills",
			},
		]
		expect(findDirectoryIdByRelativePath(list, ".magic/skills")).toBe("dir-1")
	})

	it("matches when API uses leading slash on path", () => {
		const list: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "m1",
				is_directory: true,
				relative_file_path: "/.magic",
			},
		]
		expect(findDirectoryIdByRelativePath(list, ".magic")).toBe("m1")
	})
})

describe("findDirectoryIdBySegmentWalk", () => {
	it("resolves ids by file_name chain like file tree UI", () => {
		const tree: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "m1",
				is_directory: true,
				file_name: ".magic",
				children: [
					{
						source: AttachmentSource.PROJECT_DIRECTORY,
						file_id: "s1",
						is_directory: true,
						file_name: "skills",
						children: [],
					},
				],
			},
		]
		expect(findDirectoryIdBySegmentWalk(tree, [".magic"])).toBe("m1")
		expect(findDirectoryIdBySegmentWalk(tree, [".magic", "skills"])).toBe("s1")
	})
})

describe("pickLastModifiedSkillDirWithSkillMd", () => {
	it("returns null when no SKILL.md under .magic/skills", () => {
		expect(pickLastModifiedSkillDirWithSkillMd([])).toBe(null)
	})

	it("picks dir with latest updated_at on SKILL.md", () => {
		const list: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "a",
				relative_file_path: ".magic/skills/older/SKILL.md",
				updated_at: "2020-01-01T00:00:00.000Z",
			},
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "b",
				relative_file_path: ".magic/skills/newer/SKILL.md",
				updated_at: "2025-01-01T00:00:00.000Z",
			},
		]
		expect(pickLastModifiedSkillDirWithSkillMd(list)).toBe("newer")
	})

	it("uses lexicographic tie-break when updated_at equal", () => {
		const list: AttachmentItem[] = [
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "a",
				relative_file_path: ".magic/skills/b/SKILL.md",
				updated_at: "2025-01-01T00:00:00.000Z",
			},
			{
				source: AttachmentSource.PROJECT_DIRECTORY,
				file_id: "b",
				relative_file_path: ".magic/skills/a/SKILL.md",
				updated_at: "2025-01-01T00:00:00.000Z",
			},
		]
		expect(pickLastModifiedSkillDirWithSkillMd(list)).toBe("b")
	})
})

describe("getAttachmentUpdatedAtMs", () => {
	it("reads updated_at string", () => {
		const item = {
			source: AttachmentSource.PROJECT_DIRECTORY,
			updated_at: "2025-06-01T12:00:00.000Z",
		} as AttachmentItem
		expect(getAttachmentUpdatedAtMs(item)).toBe(Date.parse("2025-06-01T12:00:00.000Z"))
	})
})

describe("parseSkillConfigYaml", () => {
	it("reads skill.dir", () => {
		expect(
			parseSkillConfigYaml(`skill:
  dir: "hello-world"
`),
		).toBe("hello-world")
	})

	it("returns null on invalid yaml", () => {
		expect(parseSkillConfigYaml("{ bad")).toBe(null)
	})
})

describe("parseSkillMdFrontmatter", () => {
	it("parses frontmatter fields", () => {
		const md = `---
name: My Skill
name-cn: 我的
description: Desc EN
description-cn: 描述
---
# Body ignored
`
		const m = parseSkillMdFrontmatter(md)
		expect(m.nameDefault).toBe("My Skill")
		expect(m.nameCn).toBe("我的")
		expect(m.descriptionDefault).toBe("Desc EN")
		expect(m.descriptionCn).toBe("描述")
	})

	it("returns empty manifest without frontmatter", () => {
		const m = parseSkillMdFrontmatter("# No frontmatter")
		expect(m.nameDefault).toBe("")
		expect(m.descriptionDefault).toBe("")
	})
})

describe("buildDefaultSlotUpdateParams", () => {
	it("fills only default when empty and preserves zh_CN", () => {
		const detail = minimalSkillDetail({
			name_i18n: {
				[SupportLocales.fallback]: "",
				[SupportLocales.enUS]: "",
				[SupportLocales.zhCN]: "中文名",
			},
			description_i18n: {
				[SupportLocales.fallback]: "",
				[SupportLocales.enUS]: "",
				[SupportLocales.zhCN]: "",
			},
		})

		const params = buildDefaultSlotUpdateParams(detail, {
			nameDefault: "From MD",
			nameCn: "",
			descriptionDefault: "",
			descriptionCn: "",
		})

		expect(params?.name_i18n?.[SupportLocales.fallback]).toBe("From MD")
		expect(params?.name_i18n?.[SupportLocales.zhCN]).toBe("中文名")
		expect(params?.description_i18n).toBeUndefined()
	})

	it("returns null when default slots already set", () => {
		const detail = minimalSkillDetail({
			name_i18n: {
				[SupportLocales.fallback]: "x",
				[SupportLocales.enUS]: "",
				[SupportLocales.zhCN]: "",
			},
			description_i18n: {
				[SupportLocales.fallback]: "y",
				[SupportLocales.enUS]: "",
				[SupportLocales.zhCN]: "",
			},
		})

		const params = buildDefaultSlotUpdateParams(detail, {
			nameDefault: "From MD",
			nameCn: "",
			descriptionDefault: "d",
			descriptionCn: "",
		})

		expect(params).toBeNull()
	})

	it("does not patch zh_CN when default empty but manifest only has zh name", () => {
		const detail = minimalSkillDetail()

		const params = buildDefaultSlotUpdateParams(detail, {
			nameDefault: "",
			nameCn: "仅中文",
			descriptionDefault: "",
			descriptionCn: "",
		})

		expect(params).toBeNull()
	})
})
