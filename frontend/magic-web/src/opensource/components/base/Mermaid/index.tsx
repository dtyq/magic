import { memo, useEffect, useMemo, useRef, useState } from "react"
import mermaid from "mermaid"

import type { Config } from "./types"
import { cx, useTheme } from "antd-style"
import { nanoid } from "nanoid"
import { useDebounceEffect, useMemoizedFn, useThrottleEffect } from "ahooks"
import MermaidRenderService from "@/opensource/services/other/MermaidRenderService"

/**
 * Properties for Mermaid component.
 */
export interface MermaidProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Mermaid diagram.
	 */
	chart?: string

	/**
	 * Config to initialize mermaid with.
	 */
	config?: Config | string

	/**
	 * Callback to handle parse errors.
	 */
	onParseError?: (err: Error) => void

	/**
	 * Render to display when there is an error.
	 */
	errorRender?: React.ReactNode
}

/**
 * Component to display Mermaid diagrams.
 *
 * @param param0 Diagram to display.
 * @param param1 Config.
 * @returns The component.
 */
export const Mermaid = memo(function Mermaid({
	chart,
	config: configSrc,
	onParseError,
	errorRender,
	...props
}: MermaidProps) {
	const config: Config = useMemo(
		() => (typeof configSrc === "string" ? JSON.parse(configSrc) : configSrc),
		[configSrc],
	)

	const idRef = useRef(`mermaid_${nanoid()}`)
	const { isDarkMode } = useTheme()
	const theme = useMemo(() => (isDarkMode ? "dark" : "default"), [isDarkMode])

	const [isError, setIsError] = useState(false)

	const getContainer = useMemoizedFn(() => {
		return document.querySelector(`[data-mermaid-id="${idRef.current}"]`)
	})

	const retryTimes = useRef(0)
	/**
	 * 渲染mermaid
	 */
	const renderMermaid = useMemoizedFn(() => {
		mermaid
			.render(idRef.current, chart as string)
			.then((svg) => {
				const container = getContainer()
				if (container) container.innerHTML = svg.svg
				if (!MermaidRenderService.isErrorSvg(svg.svg)) {
					retryTimes.current = 0
					MermaidRenderService.cache(chart as string, svg)
				} else {
					retryTimes.current++
					if (retryTimes.current < 3) {
						console.log("渲染失败，重试", retryTimes.current)
						renderMermaid()
					}
				}
			})
			.catch((err) => {
				setIsError(true)
				onParseError?.(err as Error)
			})
	})

	/**
	 * 内容加载
	 */
	const contentLoaded = useMemoizedFn(() => {
		MermaidRenderService.getCache(chart as string).then((res) => {
			const container = getContainer()
			if (res?.svg) {
				if (container) container.innerHTML = res.svg
				return
			}

			renderMermaid()
		})
	})

	useEffect(() => {
		if (config?.mermaid) {
			mermaid.initialize({ startOnLoad: true, ...config.mermaid, theme })
		} else {
			mermaid.initialize({ startOnLoad: true, theme })
		}
		document.querySelectorAll(`[data-mermaid-id="${idRef.current}"]`).forEach((v) => {
			v.removeAttribute("data-processed")
			v.innerHTML = v.getAttribute("data-mermaid-src") as string
		})
		contentLoaded()
	}, [config, contentLoaded, theme])

	useDebounceEffect(
		() => {
			contentLoaded()
		},
		[chart],
		{
			wait: 1000,
		},
	)

	if (!chart) {
		return null
	}

	return (
		<>
			{isError && errorRender}
			<div
				style={{ display: isError ? "none" : "flex", justifyContent: "center" }}
				data-mermaid-id={idRef.current}
				className={cx("mermaid", props.className)}
				data-mermaid-src={chart}
				{...props}
			>
				{chart}
			</div>
		</>
	)
})
