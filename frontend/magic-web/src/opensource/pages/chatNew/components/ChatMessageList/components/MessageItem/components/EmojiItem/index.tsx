import type { HTMLAttributes } from "react"
import { forwardRef, memo, useMemo } from "react"
import { isObject } from "lodash-es"
import { emojiLocaleCache } from "@/opensource/components/base/MagicEmojiPanel/cache"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import { useStyles } from "./styles"

interface EmojiItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
	content?: any
	isSelf?: boolean
}

interface EmojiContent {
	type: "doc"
	content: any
}

/**
 * 解析表情消息内容
 * @param content 消息内容
 * @returns 表情代码数组
 */
const parseContent = (content: string): any => {
	try {
		const parsedContent = JSON.parse(content) as EmojiContent
		const emojiCodes: any = []

		if (isObject(parsedContent) && parsedContent?.type === "doc") {
			parsedContent.content.forEach((item: any) => {
				item.content
					.filter((node: any) => node.type === "magic-emoji")
					.forEach((node: any, index: number) => {
						emojiCodes.push({
							src: `${node.attrs.ns}${node.attrs.code}${node.attrs.suffix}`,
							key: `${node.attrs.code}${index}`,
							text:
								emojiLocaleCache.get(node.attrs.code)?.zh_CN ||
								`[${node.attrs.code}]`,
						})
					})
			})
		}
		return emojiCodes
	} catch (e) {
		return []
	}
}

const EmojiItem = forwardRef<HTMLDivElement, EmojiItemProps>(({ content }, ref) => {
	const { fontSize } = useFontSize()
	const { styles } = useStyles({ fontSize })
	const emojiCodes = useMemo(() => parseContent(content as string), [content])
	return (
		<div ref={ref} className={styles.container}>
			{emojiCodes.map((item: any) => (
				<img
					key={item.key}
					src={`/emojis/${item.src}`}
					alt={item.text}
					className={styles.emoji}
					data-type="magic-emoji"
				/>
			))}
		</div>
	)
})

const MemoEmojiItem = memo((props: EmojiItemProps) => {
	return <EmojiItem {...props} />
})

export default MemoEmojiItem
