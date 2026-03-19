import { downloadFileContent } from "@/pages/superMagic/utils/api"
import { isRelativePath } from "../../../contents/HTML/utils"

/**
 * SlideLoaderService - Responsible for downloading slide content
 * Pure service layer without state management
 */
export class SlideLoaderService {
	/**
	 * Load slide content from URL
	 * @param url - Slide URL to download
	 * @returns Raw HTML content string
	 */
	async loadSlide(url: string): Promise<string> {
		if (!url) {
			throw new Error("Slide URL is required")
		}

		if (isRelativePath(url)) {
			return ""
		}

		try {
			const content = await downloadFileContent(url)
			return typeof content === "string" ? content : ""
		} catch (error) {
			console.error(`Failed to load slide from URL: ${url}`, error)
			throw error
		}
	}

	/**
	 * Load multiple slides in parallel
	 * @param urls - Array of slide URLs
	 * @returns Map of index to content
	 */
	async loadSlides(urls: string[]): Promise<Map<number, string>> {
		const results = new Map<number, string>()

		const loadPromises = urls.map(async (url, index) => {
			try {
				const content = await this.loadSlide(url)
				return { index, content }
			} catch (error) {
				console.error(`Failed to load slide at index ${index}:`, error)
				return { index, content: "" }
			}
		})

		const loadedSlides = await Promise.all(loadPromises)

		loadedSlides.forEach(({ index, content }) => {
			results.set(index, content)
		})

		return results
	}
}
