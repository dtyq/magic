import hash from "@/MagicExpressionWidget/utils"
import { useMemoizedFn } from "ahooks"
import React, { useEffect, useMemo, useState } from "react"
import styleModule from "./style.module.less"

export const backgrounds = [
	"linear-gradient(150.26deg, #72A2FF 20.13%, #3B81F7 90.48%)",
	"linear-gradient(150.26deg, #FFDD7C 20.13%, #FF9900 90.48%)",
	"linear-gradient(150.26deg, #34E7B1 20.13%, #2FD2A1 90.48%)",
	"linear-gradient(150.26deg, #FA7D7D 20.13%, #F94747 90.48%)",
]

const SIZE_MAP: Record<string, number> = {
	large: 40,
	small: 24,
}
export default function TsAvatar({
	src = "", // 头像 url
	alt = "", // 头像加载失败时显示的文字，截取最后两个字
	size = 42, // 尺寸
	className = "",
	style = {},
	sliceLen = 0,
	...props
}) {
	const [url, setUrl] = useState(src)
	const onImageError = useMemoizedFn(() => {
		setUrl("")
	})

	const background = useMemo(() => {
		let i = hash(alt, backgrounds.length)
		return backgrounds[i]
	}, [alt])

	const wh = useMemo(() => {
		if (!isNaN(size)) return size
		return SIZE_MAP[size] || 32
	}, [size])

	const nameLen = useMemo(() => {
		if (sliceLen) return sliceLen
		if (size < 42) return -1
		return -2
	}, [sliceLen, size])

	const fontSize = useMemo(() => {
		let s = (14 * wh) / 42
		if (s < 14) s = 14
		return s
	}, [wh])

	useEffect(() => {
		setUrl(src)
	}, [src])

	return (
		<div
			className={`${className} ${styleModule.wrap}`}
			style={{
				...style,
				width: wh,
				height: wh,
			}}
			{...props}
		>
			{url ? (
				<img src={url} alt={alt} onError={onImageError} />
			) : (
				<div style={{ background, fontSize: fontSize }}>{alt && alt.slice(nameLen)}</div>
			)}
		</div>
	)
}
