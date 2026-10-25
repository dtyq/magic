import type { LocaleTextMap } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import characterSheet from "./images/character-sheet.webp"
import characterSheetDusk from "./images/character-sheet-dusk.webp"
import poster from "./images/poster.webp"
import product from "./images/product.webp"
import product02 from "./images/product-02.webp"
import product03 from "./images/product-03.webp"
import storyboard01 from "./images/storyboard-01.webp"
import storyboard02 from "./images/storyboard-02.webp"
import storyboard03 from "./images/storyboard-03.webp"

/** What a showcase artwork depicts; also decides its frame label and aspect ratio. */
export type ShowcaseKind = "poster" | "character" | "storyboard" | "product"

export interface ShowcaseArtwork {
	key: string
	kind: ShowcaseKind
	/** Bundled WebP imported from ./images (tracked with Git LFS). */
	src: string
	/**
	 * Same artwork after the hero board's annotation edit ("change the background to a beach
	 * at dusk, keep the characters"). Composition must match `src` exactly so the hero can
	 * animate the edit in place.
	 */
	editedSrc?: string
	/** Prompt a user gets via "use this"; it fills the home composer, it is not sent. */
	prompt: LocaleTextMap
	title: LocaleTextMap
}

/**
 * Built-in showcase artworks of the AI canvas home: one story ("a girl and her corgi at a
 * dusk seaside") shown as a character sheet, a key visual, three products and three storyboard
 * frames. Storyboard 03 is storyboard 02 with only the background changed, matching the
 * annotation note on the hero board.
 *
 * They decorate the hero board and fill the inspiration wall when the design employee has
 * no configured inspirations. Sources and generation prompts are recorded in ./README.md.
 * Storyboard entries keep their order: the hero shows them left to right. Product entries keep
 * theirs too: the first is the front card of the hero's product fan.
 */
export const AI_CANVAS_SHOWCASE: ShowcaseArtwork[] = [
	{
		key: "poster",
		kind: "poster",
		src: poster,
		title: { zh_CN: "黄昏悬崖主视觉", en_US: "Dusk cliff key visual" },
		prompt: {
			zh_CN: "做一张电影感主视觉海报：女孩和柯基坐在海边悬崖上看夕阳，粉紫色晚霞，上方留出标题空间",
			en_US: "Create a cinematic key visual poster: a girl and her corgi sitting on a seaside cliff watching the sunset under pink and violet clouds, with empty sky at the top for a title",
		},
	},
	{
		key: "character-sheet",
		kind: "character",
		src: characterSheet,
		editedSrc: characterSheetDusk,
		title: { zh_CN: "少女与柯基角色设定", en_US: "Girl and corgi character sheet" },
		prompt: {
			zh_CN: "设计一个角色设定图：穿浅黄色雨衣、短发的小女孩和一只戴红围巾的柯基，正面全身，干净的淡紫色背景",
			en_US: "Design a character sheet: a short-haired girl in a pale yellow raincoat and a corgi wearing a red scarf, full-body front view on a clean lavender background",
		},
	},
	{
		key: "product",
		kind: "product",
		src: product,
		title: { zh_CN: "黄昏汽水产品图", en_US: "Dusk soda product shot" },
		prompt: {
			zh_CN: "拍一张高级感产品图：粉紫渐变的汽水玻璃瓶放在沙色石台上，黄昏侧光，背景干净",
			en_US: "Shoot a premium product image: a glass soda bottle with a pink-to-violet gradient drink on a sand-colored stone pedestal, dusk side light, clean background",
		},
	},
	{
		key: "product-02",
		kind: "product",
		src: product02,
		title: { zh_CN: "拍立得相机产品图", en_US: "Instant camera product shot" },
		prompt: {
			zh_CN: "拍一张高级感产品图：淡紫色复古拍立得相机放在沙色石台上，吐出一张空白相纸，黄昏侧光，背景干净",
			en_US: "Shoot a premium product image: a lavender retro instant camera on a sand-colored stone pedestal, ejecting a blank photo, dusk side light, clean background",
		},
	},
	{
		key: "product-03",
		kind: "product",
		src: product03,
		title: { zh_CN: "贝壳香水产品图", en_US: "Seashell perfume product shot" },
		prompt: {
			zh_CN: "拍一张高级感产品图：桃色到靛蓝渐变的多切面香水瓶，贝壳形珍珠白瓶盖，放在沙色石台上，黄昏侧光，背景干净",
			en_US: "Shoot a premium product image: a faceted perfume bottle fading from peach to indigo with a pearl-white seashell cap on a sand-colored stone pedestal, dusk side light, clean background",
		},
	},
	{
		key: "storyboard-01",
		kind: "storyboard",
		src: storyboard01,
		title: { zh_CN: "分镜 01 · 出发", en_US: "Storyboard 01 · Setting off" },
		prompt: {
			zh_CN: "为一个小故事画 3 帧分镜：女孩和柯基在海边奔跑、发现发光的贝壳、黄昏的海边，角色保持一致",
			en_US: "Draw a 3-frame storyboard for a short story: a girl and her corgi running by the sea, finding a glowing seashell, then the beach at dusk, keeping the characters consistent",
		},
	},
	{
		key: "storyboard-02",
		kind: "storyboard",
		src: storyboard02,
		title: { zh_CN: "分镜 02 · 发现", en_US: "Storyboard 02 · Discovery" },
		prompt: {
			zh_CN: "画一帧分镜：女孩跪在沙滩上捧着一枚发光的贝壳，柯基坐在旁边好奇地看，金色侧光",
			en_US: "Draw a storyboard frame: a girl kneeling on the sand holding a glowing seashell while her corgi watches curiously, golden side light",
		},
	},
	{
		key: "storyboard-03",
		kind: "storyboard",
		src: storyboard03,
		title: { zh_CN: "分镜 03 · 黄昏海边", en_US: "Storyboard 03 · Beach at dusk" },
		prompt: {
			zh_CN: "把这帧分镜的背景换成黄昏的海边，人物和构图保持不变",
			en_US: "Change the background of this storyboard frame to a beach at dusk and keep the characters and composition unchanged",
		},
	},
]
