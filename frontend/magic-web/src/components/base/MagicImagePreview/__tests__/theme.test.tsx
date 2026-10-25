import { render, screen } from "@testing-library/react"
import { ThemeProvider, useTheme } from "antd-style"
import { genPalettesConfigs } from "@/providers/ThemeProvider/utils"
import { describe, expect, it, vi } from "vitest"
import usePreviewStyles from "../styles"
import PreviewThemeBoundary from "../PreviewThemeBoundary"
import MagicImagePreview from ".."
import { useStyles as useImageStyles } from "../components/ImageWrapper/styles"

// Exercise the real toolbar controls rather than the global minimal Ant Design mock.
vi.unmock("antd")

function PreviewStylesProbe() {
	const { styles } = usePreviewStyles()
	const { isDarkMode } = useTheme()
	return (
		<div
			data-testid="preview"
			data-appearance={isDarkMode ? "dark" : "light"}
			className={styles.container}
		/>
	)
}

function ImageStylesProbe() {
	const { styles } = useImageStyles()
	return <div data-testid="image-error" className={styles.imageLoadError} />
}

vi.mock("@/pages/superMagic/components/Detail/contents/Image/hooks/useDownloadImageMenu", () => ({
	useDownloadImageMenu: () => ({
		agreementModal: null,
		downloadImageDropdownItems: [],
		downloadMenuClick: vi.fn(),
	}),
}))

describe("image preview theme boundaries", () => {
	it("renders the complete preview toolbar with no custom theme", () => {
		render(
			<MagicImagePreview hasCompare>
				<img src="data:image/png;base64," alt="Preview image" />
			</MagicImagePreview>,
		)
		expect(screen.getByAltText("Preview image")).toBeInTheDocument()
		expect(screen.getAllByRole("button").length).toBeGreaterThan(1)
	})

	it("renders the preview without a Magic theme provider", () => {
		render(
			<PreviewThemeBoundary>
				<PreviewStylesProbe />
			</PreviewThemeBoundary>,
		)
		expect(screen.getByTestId("preview")).toBeInTheDocument()
	})

	it("renders the image error surface without a Magic theme provider", () => {
		render(
			<PreviewThemeBoundary>
				<ImageStylesProbe />
			</PreviewThemeBoundary>,
		)
		expect(screen.getByTestId("image-error")).toBeInTheDocument()
	})

	it.each(["light", "dark"] as const)("uses a visible %s fallback surface", (appearance) => {
		render(
			<ThemeProvider appearance={appearance}>
				<PreviewThemeBoundary>
					<PreviewStylesProbe />
					<ImageStylesProbe />
				</PreviewThemeBoundary>
			</ThemeProvider>,
		)
		for (const id of ["preview", "image-error"]) {
			expect(getComputedStyle(screen.getByTestId(id)).backgroundColor).not.toBe(
				"rgba(0, 0, 0, 0)",
			)
		}
		const expected = document.createElement("div")
		expected.style.backgroundColor = genPalettesConfigs(appearance).magicColorScales.grey[0]
		expect(getComputedStyle(screen.getByTestId("preview")).backgroundColor).toBe(
			expected.style.backgroundColor,
		)
		expect(screen.getByTestId("preview")).toHaveAttribute("data-appearance", appearance)
	})

	it("fills missing usages without replacing a supplied color scale", () => {
		const tokens = genPalettesConfigs("light")
		const grey: typeof tokens.magicColorScales.grey = [...tokens.magicColorScales.grey]
		grey[0] = "rgb(11, 22, 33)"
		render(
			<ThemeProvider
				theme={{ token: { magicColorScales: { ...tokens.magicColorScales, grey } } }}
			>
				<PreviewThemeBoundary>
					<PreviewStylesProbe />
					<ImageStylesProbe />
				</PreviewThemeBoundary>
			</ThemeProvider>,
		)
		expect(getComputedStyle(screen.getByTestId("preview")).backgroundColor).toBe(
			"rgb(11, 22, 33)",
		)
		expect(screen.getByTestId("image-error")).toBeInTheDocument()
	})

	it("preserves supplied Magic colors", () => {
		const tokens = genPalettesConfigs("light")
		const grey: typeof tokens.magicColorScales.grey = [...tokens.magicColorScales.grey]
		grey[0] = "rgb(11, 22, 33)"
		render(
			<ThemeProvider
				theme={{
					token: {
						...tokens,
						magicColorScales: { ...tokens.magicColorScales, grey },
						magicColorUsages: {
							...tokens.magicColorUsages,
							bg: { ...tokens.magicColorUsages.bg, 1: "rgb(44, 55, 66)" },
						},
					},
				}}
			>
				<PreviewThemeBoundary>
					<PreviewStylesProbe />
					<ImageStylesProbe />
				</PreviewThemeBoundary>
			</ThemeProvider>,
		)
		expect(getComputedStyle(screen.getByTestId("preview")).backgroundColor).toBe(
			"rgb(11, 22, 33)",
		)
		expect(getComputedStyle(screen.getByTestId("image-error")).backgroundColor).toBe(
			"rgb(44, 55, 66)",
		)
	})
})
