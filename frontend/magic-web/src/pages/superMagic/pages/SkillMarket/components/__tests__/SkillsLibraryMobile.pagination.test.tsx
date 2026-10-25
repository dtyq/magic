import { act, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ReactNode, Ref } from "react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const navigateMock = vi.fn()
const getStoreSkillsMock = vi.fn()
const getUserSkillIdMapByCodesMock = vi.fn()

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: "en_US" },
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: ComponentProps<"button">) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/components/shadcn-ui/scroll-area", () => ({
	ScrollArea: ({
		children,
		viewportRef,
	}: {
		children: ReactNode
		viewportRef?: Ref<HTMLDivElement>
	}) => (
		<div data-testid="mock-scroll-area">
			<div ref={viewportRef} data-testid="mock-scroll-viewport">
				{children}
			</div>
		</div>
	),
}))

vi.mock("@/components/shadcn-ui/sheet", () => ({
	Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/pages/superMagic/components/SkillDetailDialog", () => ({
	SkillDetailDialog: () => null,
}))

vi.mock("@/enhance/lucide-react", () => ({
	Skills: () => <span data-testid="skills-icon" />,
}))

vi.mock("@/pages/superMagic/hooks/useDelayedVisibility", () => ({
	useDelayedVisibility: ({ visible }: { visible: boolean }) => visible,
}))

vi.mock("@/routes/hooks/useNavigate", () => ({
	default: () => navigateMock,
}))

vi.mock("@/routes/constants", () => ({
	RouteName: {
		MySkills: "MySkills",
	},
}))

vi.mock("@/services/skills/SkillsService", () => ({
	skillsService: {
		getSkillMarketCategories: vi.fn().mockResolvedValue([]),
		getStoreSkills: (...args: unknown[]) => getStoreSkillsMock(...args),
		getUserSkillIdMapByCodes: (...args: unknown[]) => getUserSkillIdMapByCodesMock(...args),
		addSkillFromStore: vi.fn(),
		deleteSkill: vi.fn(),
		upgradeSkill: vi.fn(),
	},
}))

vi.mock("../StoreSkillCardMobile", () => ({
	StoreSkillCardMobile: ({ skill }: { skill: { id: string } }) => (
		<div data-testid={`mock-skill-card-${skill.id}`}>{skill.id}</div>
	),
}))

describe("SkillsLibraryMobile pagination", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		getStoreSkillsMock
			.mockResolvedValueOnce({
				list: Array.from({ length: 20 }, (_, index) => ({
					id: `skill-${index + 1}`,
					storeSkillId: `store-skill-${index + 1}`,
					skillCode: `skill.code.${index + 1}`,
					name: `Skill ${index + 1}`,
					description: "First skill",
					isFeatured: false,
					status: "not-added" as const,
					publisherType: "OFFICIAL" as const,
					needUpgrade: false,
					updatedAt: "2026-03-23 10:00:00",
				})),
				page: 1,
				pageSize: 20,
			})
			.mockResolvedValueOnce({
				list: Array.from({ length: 20 }, (_, index) => ({
					id: `featured-skill-${index + 1}`,
					storeSkillId: `featured-store-skill-${index + 1}`,
					skillCode: `featured.skill.code.${index + 1}`,
					name: `Featured Skill ${index + 1}`,
					description: "Featured skill",
					isFeatured: true,
					status: "not-added",
					publisherType: "OFFICIAL",
					needUpgrade: false,
					updatedAt: "2026-03-23 10:00:00",
				})),
				page: 1,
				pageSize: 20,
			})
			.mockResolvedValueOnce({
				list: [
					{
						id: "skill-2",
						storeSkillId: "store-skill-2",
						skillCode: "skill.code.2",
						name: "Skill 2",
						description: "Second skill",
						isFeatured: false,
						status: "not-added",
						publisherType: "OFFICIAL",
						needUpgrade: false,
						updatedAt: "2026-03-23 11:00:00",
					},
				],
				page: 2,
				pageSize: 20,
			})
		getUserSkillIdMapByCodesMock.mockResolvedValue(new Map())
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("deduplicates initial requests in StrictMode and loads more", async () => {
		const { default: SkillsLibraryMobile } = await import("../SkillsLibraryMobile")
		const observe = vi.fn()
		const disconnect = vi.fn()
		const intersectionObserver = vi.fn(
			(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => ({
				observe,
				disconnect,
				unobserve: vi.fn(),
				takeRecords: vi.fn(),
				root: options?.root ?? null,
				rootMargin: options?.rootMargin ?? "",
				thresholds: [],
				callback,
			}),
		)

		vi.stubGlobal("IntersectionObserver", intersectionObserver)

		render(
			<StrictMode>
				<SkillsLibraryMobile />
			</StrictMode>,
		)

		await waitFor(() => {
			expect(getStoreSkillsMock).toHaveBeenCalled()
			expect(intersectionObserver).toHaveBeenCalled()
		})

		await act(async () => {
			screen.getByTestId("skill-category-featured").click()
		})
		await waitFor(() => {
			expect(getStoreSkillsMock).toHaveBeenLastCalledWith({
				page: 1,
				page_size: 20,
				keyword: undefined,
				publisher_type: undefined,
				category_ids: undefined,
				is_featured: 1,
			})
		})

		expect(screen.getByTestId("skills-library-mobile-scroll-sentinel")).toBeInTheDocument()

		const viewport = screen.getByTestId("mock-scroll-viewport")
		const observerOptions = intersectionObserver.mock.calls[0]?.[1]
		expect(observerOptions?.root).toBe(viewport)
		expect(observerOptions?.rootMargin).toBe("160px 0px")

		const callback = intersectionObserver.mock.calls[0]?.[0] as IntersectionObserverCallback

		await act(async () => {
			callback(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			)
		})

		await waitFor(() => {
			expect(getStoreSkillsMock).toHaveBeenCalledTimes(3)
		})

		expect(getStoreSkillsMock.mock.calls[2]?.[0]).toMatchObject({
			page: 2,
			page_size: 20,
			keyword: undefined,
			is_featured: 1,
		})
		expect(observe).toHaveBeenCalled()
		expect(disconnect).toHaveBeenCalled()
	})
})
