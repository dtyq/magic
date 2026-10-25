import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreSkillView } from "@/services/skills/SkillsService"

const getStoreSkillsMock = vi.fn()
const getSkillMarketCategoriesMock = vi.fn()
const useFunctionPermissionMock = vi.hoisted(() => vi.fn())

vi.mock("ahooks", () => ({
	useDebounce: <T,>(value: T) => value,
	useThrottle: <T,>(value: T) => value,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"skillsLibrary.allSkills": "All Skills",
				"skillsLibrary.category": "Category",
				"skillsLibrary.categoriesLoadFailed": "Failed to load categories",
				"skillsLibrary.featured": "Featured",
				"skillsLibrary.featuredSkills": "Featured Skills",
				"skillsLibrary.retryFeatured": "Retry",
				"skillsLibrary.refreshFeatured": "Refresh",
				"skillsLibrary.featuredLoadFailed": "Failed to load featured skills",
			})[key] ?? key,
	}),
}))

vi.mock("lucide-react", () => {
	function Icon() {
		return <span aria-hidden="true" />
	}

	return {
		Check: Icon,
		ChevronDown: Icon,
		Loader2: Icon,
		Plus: Icon,
		RefreshCw: Icon,
		Search: Icon,
		WandSparkles: Icon,
	}
})

vi.mock("sonner", () => ({
	toast: { error: vi.fn() },
}))

vi.mock("@/apis", () => ({
	FUNCTION_PERMISSION_CODE: {
		SkillCreate: "SkillCreate",
	},
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		variant,
		size,
		...props
	}: ComponentProps<"button"> & { variant?: string; size?: string }) => {
		void variant
		void size

		return (
			<button type="button" {...props}>
				{children}
			</button>
		)
	},
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/enhance/lucide-react", () => ({
	Skills: () => <span aria-hidden="true" />,
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermission: (code: string, options?: { allowSuperAdmin?: boolean }) =>
		useFunctionPermissionMock(code, options),
}))

vi.mock("@/models/config", () => ({
	configStore: { i18n: { displayLanguage: "en_US" } },
}))

vi.mock("@/pages/superMagic/components/SkillActionDropdown", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/components/SkillDetailDialog", () => ({
	SkillDetailDialog: (props: {
		open: boolean
		skillCode: string | null
		skillSummary?: StoreSkillView | null
	}) => null,
}))

vi.mock("@/pages/superMagic/hooks/useAutoLoadMoreSentinel", () => ({
	useAutoLoadMoreSentinel: () => ({ current: null }),
}))

vi.mock("@/pages/superMagic/hooks/useDelayedVisibility", () => ({
	useDelayedVisibility: ({ visible }: { visible: boolean }) => visible,
}))

vi.mock("@/pages/superMagic/hooks/useSkillCreateMenuItems", () => ({
	useSkillCreateMenuItems: () => [],
}))

vi.mock("@/pages/superMagic/pages/MySkillsPage/route-state", () => ({
	MY_SKILLS_INITIAL_TAB_QUERY_KEY: "tab",
	MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY: "publishSkillCode",
	MY_SKILLS_TAB_VALUES: { createdByMe: "created-by-me" },
}))

vi.mock("@/routes/constants", () => ({
	RouteName: { MySkills: "MySkills" },
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => vi.fn(),
}))

vi.mock("@/services/skills/SkillsService", () => ({
	skillsService: {
		getSkillMarketCategories: (...args: unknown[]) => getSkillMarketCategoriesMock(...args),
		getStoreSkills: (...args: unknown[]) => getStoreSkillsMock(...args),
		addSkillFromStore: vi.fn(),
		upgradeSkill: vi.fn(),
	},
}))

vi.mock("../SkillCard", () => ({
	default: (props: {
		skill: StoreSkillView
		showFeaturedTag?: boolean
		onOpenDetail?: (skill: StoreSkillView) => void
	}) => {
		return (
			<button
				type="button"
				aria-label={props.skill.name}
				onClick={() => props.onOpenDetail?.(props.skill)}
			>
				{props.skill.name}
			</button>
		)
	},
}))

import SkillsLibrary from "../SkillsLibrary"

function createSkill(overrides: Partial<StoreSkillView>): StoreSkillView {
	return {
		id: "skill-1",
		storeSkillId: "store-skill-1",
		skillCode: "skill.code",
		name: "Skill",
		description: "Description",
		isFeatured: false,
		status: "not-added",
		needUpgrade: false,
		updatedAt: "2026-08-17 10:00:00",
		...overrides,
	}
}

function createPage(list: StoreSkillView[], page: number, pageSize: number) {
	return { list, page, pageSize }
}

describe("SkillsLibrary", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		useFunctionPermissionMock.mockImplementation(() => ({ isAllowed: false }))
		getStoreSkillsMock.mockReset()
		getSkillMarketCategoriesMock.mockReset()
		getSkillMarketCategoriesMock.mockResolvedValue([])
	})

	it("uses the all-skills tab when the category endpoint is empty", async () => {
		getStoreSkillsMock.mockResolvedValue(createPage([], 1, 20))

		render(<SkillsLibrary />)

		expect(await screen.findByRole("tab", { name: "All Skills" })).toBeInTheDocument()
		expect(screen.getByTestId("skills-library-search-bar")).toHaveClass(
			"rounded-xl",
			"border-border",
			"shadow-xs",
		)
		expect(screen.queryByRole("tab", { name: "All", exact: true })).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("skills-library-upload-official-button"),
		).not.toBeInTheDocument()
	})

	it("loads populated categories and filters the skill list by string id", async () => {
		getSkillMarketCategoriesMock.mockResolvedValueOnce([
			{
				id: "10001",
				name: "Productivity",
				sortOrder: 100,
				skillCount: 0,
			},
		])
		getStoreSkillsMock.mockImplementation(({ is_featured }: { is_featured?: number }) =>
			Promise.resolve(createPage([], 1, is_featured === 1 ? 6 : 20)),
		)

		render(<SkillsLibrary />)

		expect(await screen.findByRole("tab", { name: "Productivity" })).toBeInTheDocument()
		expect(getSkillMarketCategoriesMock).toHaveBeenCalledWith()

		fireEvent.click(screen.getByRole("tab", { name: "Productivity" }))

		await waitFor(() => {
			expect(getStoreSkillsMock).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 1,
					category_ids: ["10001"],
				}),
			)
		})
	})

	it("filters the main list by featured status from the featured tab", async () => {
		const featuredSkill = createSkill({
			id: "global-featured",
			skillCode: "global.featured",
			name: "Global featured",
			isFeatured: true,
		})
		getSkillMarketCategoriesMock.mockResolvedValueOnce([
			{
				id: "10001",
				name: "Productivity",
				sortOrder: 100,
				skillCount: 1,
			},
		])
		getStoreSkillsMock.mockImplementation(({ is_featured }: { is_featured?: number }) =>
			Promise.resolve(createPage(is_featured === 1 ? [featuredSkill] : [], 1, 20)),
		)

		render(<SkillsLibrary />)

		const featuredTab = await screen.findByRole("tab", { name: "Featured" })
		fireEvent.click(featuredTab)

		await waitFor(() => {
			expect(getStoreSkillsMock).toHaveBeenLastCalledWith(
				expect.objectContaining({ category_ids: undefined, is_featured: 1, page: 1 }),
			)
		})
		expect(screen.getByTestId("skill-category-featured")).toHaveAttribute(
			"aria-selected",
			"true",
		)
		expect(screen.getByRole("button", { name: "Global featured" })).toBeInTheDocument()
	})
})
