import type { BoardArtwork } from "../components/AiCanvasHero"
import type { AiCanvasInspirationGroup } from "../hooks/useDesignInspirations"
import { AI_CANVAS_SHOWCASE } from "../showcase"

/**
 * Artworks for the hero board. Only the built-in showcase is used: the board is product
 * decoration, so it never shows the user's own canvases or operations-configured content.
 * While the showcase is empty every slot renders a vector placeholder.
 */
export function buildBoardArtworks(): BoardArtwork[] {
	return AI_CANVAS_SHOWCASE.map((artwork) => ({
		key: `showcase:${artwork.key}`,
		kind: artwork.kind,
		url: artwork.src,
		editedUrl: artwork.editedSrc,
	}))
}

/** Wraps the built-in showcase as one inspiration group; empty when there is no showcase. */
export function buildShowcaseInspirationGroups(groupName: string): AiCanvasInspirationGroup[] {
	if (AI_CANVAS_SHOWCASE.length === 0) return []
	return [
		{
			key: "showcase",
			name: groupName,
			items: AI_CANVAS_SHOWCASE.map((artwork) => ({
				value: artwork.key,
				label: artwork.title,
				prompt: artwork.prompt,
				thumbnail_url: artwork.src,
			})),
		},
	]
}
