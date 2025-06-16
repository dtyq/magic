import type { CommonQuickInstruction } from "@/types/bot"
import { InstructionType } from "@/types/bot"
import { t } from "i18next"
import { safeJsonToBtoa } from "@/utils/encoding"

const EmojiBasePath = "/emojis/"

const getQuickInstructionValue = (value: string, instruction: CommonQuickInstruction) => {
	switch (instruction?.type) {
		case InstructionType.SWITCH:
			return instruction?.name
		case InstructionType.SINGLE_CHOICE:
			return instruction?.values.find((option: any) => option.id === value)?.value ?? value
		default:
			return value
	}
}

const textStyle = {
	attrs: {
		fontSize: { default: null },
		fontFamily: { default: null },
		fontWeight: { default: null },
		fontStyle: { default: null },
		textDecoration: { default: null },

		color: { default: null },
		backgroundColor: { default: null },

		textAlign: { default: null },
		lineHeight: { default: null },
		letterSpacing: { default: null },
		wordSpacing: { default: null },

		textTransform: { default: null },

		opacity: { default: null },
		visibility: { default: null },
	},
	parseDOM: [
		{
			tag: "span.text-style",
			getAttrs: (dom: HTMLElement) => ({
				fontSize: dom.style.fontSize,
				fontFamily: dom.style.fontFamily,
				fontWeight: dom.style.fontWeight,
				fontStyle: dom.style.fontStyle,
				textDecoration: dom.style.textDecoration,
				color: dom.style.color,
				backgroundColor: dom.style.backgroundColor,
				textAlign: dom.style.textAlign,
				lineHeight: dom.style.lineHeight,
				letterSpacing: dom.style.letterSpacing,
				wordSpacing: dom.style.wordSpacing,
				textTransform: dom.style.textTransform,
				opacity: dom.style.opacity,
				visibility: dom.style.visibility,
			}),
		},
	],
	toDOM: (node: any) => {
		const style = Object.entries(node.attrs)
			.filter(([_, value]) => value !== null)
			.map(
				([key, value]) =>
					`${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${value}`,
			)
			.join("; ")

		return [
			"span",
			{
				style,
			},
		]
	},
}

const highlight = {
	attrs: {
		color: { default: null },
	},
	parseDOM: [
		{
			tag: "mark",
			getAttrs: (dom: HTMLElement) => ({
				color:
					(dom as HTMLElement).getAttribute("data-color") ||
					(dom as HTMLElement).style.backgroundColor,
			}),
		},
	],
	toDOM: (node: any) => {
		const { color } = node.attrs
		if (!color) return []
		return [
			"mark",
			{
				"data-color": color,
				style: `background-color: ${color}; color: inherit`,
			},
		]
	},
}

export default {
	nodes: {
		doc: {
			content: "block+",
		},
		paragraph: {
			group: "block",
			content: "inline*",
			parseDOM: [{ tag: "p" }],
			toDOM: () => ["p", 0],
		},
		text: {
			group: "inline",
		},
		mention: {
			inline: true,
			group: "inline",
			attrs: {
				type: {
					default: "user",
				},
				id: {
					default: "",
				},
				label: {
					default: "",
				},
				avatar: {
					default: "",
				},
			},
			parseDOM: [
				{
					tag: "span.mention",
					getAttrs: (dom: HTMLElement) => ({
						type: (dom as HTMLElement).getAttribute("type"),
						id: (dom as HTMLElement).getAttribute("id"),
						label: (dom as HTMLElement).getAttribute("label"),
						avatar: (dom as HTMLElement).getAttribute("avatar"),
					}),
				},
			],
			toDOM: (node: any) => {
				const { type, id, label, avatar } = node.attrs
				return [
					"span",
					{
						class: "mention",
						type,
						id,
						label,
						avatar,
						style: "color: #315cec;",
					},
					`@${label}`,
				]
			},
		},
		"magic-emoji": {
			inline: true,
			group: "inline",
			attrs: {
				alt: { default: "" },
				code: { default: "" },
				ns: { default: "emojis/" },
				suffix: { default: ".png" },
				size: { default: 20 },
				locale: { default: "zh_CN" },
			},
			parseDOM: [
				{
					tag: "img.magic-emoji",
					getAttrs: (dom: HTMLElement) => ({
						alt: (dom as HTMLElement).getAttribute("alt"),
						code: (dom as HTMLElement).getAttribute("data-code"),
						ns: (dom as HTMLElement).getAttribute("data-ns"),
						suffix: (dom as HTMLElement).getAttribute("data-suffix"),
						size: Number((dom as HTMLElement).getAttribute("data-size")),
						locale: (dom as HTMLElement).getAttribute("data-locale"),
					}),
				},
			],
			toDOM: (node: any) => {
				const { code, ns, suffix, size, locale } = node.attrs
				return [
					"img",
					{
						class: "magic-emoji",
						src: `${EmojiBasePath}${ns}${code}${suffix}`,
						width: size,
						height: size,
						alt: code,
						draggable: false,
						"data-code": code,
						"data-ns": ns,
						"data-suffix": suffix,
						"data-size": size,
						"data-locale": locale,
						style: `width: ${size}px; height: ${size}px; vertical-align: middle;`,
					},
				]
			},
		},
		image: {
			inline: true,
			group: "inline",
			attrs: {
				src: {},
				file_id: {},
				alt: { default: null },
				title: { default: null },
				hidden_detail: { default: false },
				style: {
					default:
						"max-width: 240px; max-height: 240px; object-fit: contain; cursor: pointer;",
				},
			},
			parseDOM: [
				{
					tag: "img[src]",
					getAttrs: (dom: HTMLElement) => {
						return {
							src: dom.getAttribute("src"),
							alt: dom.getAttribute("alt"),
							title: dom.getAttribute("title"),
							fileId: dom.getAttribute("file_id"),
							style: "max-width: 240px; max-height: 240px; object-fit: contain; cursor: pointer;",
						}
					},
				},
			],
			toDOM: (node: any) => {
				if (node.attrs.hidden_detail) {
					return [
						"span",
						{
							style: "position: relative; top: -0.5px;",
						},
						t("chat.messageTextRender.image", { ns: "interface" }),
					]
				}

				const dataFileInfo = safeJsonToBtoa({
					url: node.attrs.src,
					ext: { ext: "jpg", mime: "image/jpeg" }, // 默认认为是 jpg, 并不需要具体知道是什么类型的, 暂时不影响判断
					fileId: node.attrs.file_id,
					index: node.attrs.index,
					standalone: node.attrs.standalone,
					useHDImage: false,
					fileSize: node.attrs.file_size,
				})

				return [
					"img",
					{
						...node.attrs,
						class: "magic-image",
						"data-file-info": dataFileInfo,
						draggable: false,
					},
				]
			},
		},
		hardBreak: {
			group: "block",
			parseDOM: [{ tag: "br" }],
			toDOM: () => ["br"],
		},
		"quick-instruction": {
			inline: true,
			group: "inline",
			attrs: {
				value: {
					default: "",
					isRequired: true,
				},
				instruction: {
					default: null,
				},
				hidden_detail: {
					default: false,
				},
			},
			parseDOM: [
				{
					tag: "span.quick-instruction",
					getAttrs: (dom: HTMLElement) => ({
						value: (dom as HTMLElement).getAttribute("data-value"),
					}),
				},
			],
			toDOM: (node: any) => {
				const { value, instruction, hidden_detail } = node.attrs
				return [
					"span",
					{
						class: "quick-instruction",
						"data-value": value,
						"data-hidden": hidden_detail,
					},
					getQuickInstructionValue(value, instruction),
				]
			},
		},
	},
	marks: {
		textStyle,
		highlight,
	},
}

export const richTextNode = ["mention", "magic-emoji", "image", "quick-instruction"]
