// @ts-nocheck
import React, { useRef, useEffect, useState, useMemo } from "react"
import { Node, Edge } from "reactflow"

interface CanvasRendererProps {
	nodes: Node[]
	edges: Edge[]
	viewport?: { x: number; y: number; zoom: number }
}

/**
 * 使用纯Canvas渲染流程图的组件
 * 用于对比ReactFlow DOM渲染与Canvas渲染的性能差异
 */
const CanvasRenderer: React.FC<CanvasRendererProps> = ({
	nodes,
	edges,
	viewport = { x: 0, y: 0, zoom: 1 },
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [size, setSize] = useState({ width: 0, height: 0 })
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
	const [localViewport, setLocalViewport] = useState(viewport)
	const [fps, setFps] = useState(0)

	// 性能监测相关
	const fpsCountRef = useRef(0)
	const lastTimeRef = useRef(performance.now())
	const animationFrameRef = useRef<number | null>(null)

	// 调整画布大小
	useEffect(() => {
		if (!containerRef.current) return

		const updateSize = () => {
			if (containerRef.current) {
				const { width, height } = containerRef.current.getBoundingClientRect()
				setSize({ width, height })
			}
		}

		updateSize()
		window.addEventListener("resize", updateSize)
		return () => window.removeEventListener("resize", updateSize)
	}, [])

	// 计算节点坐标
	const transformedNodes = useMemo(() => {
		return nodes.map((node) => {
			const x = node.position.x * localViewport.zoom + localViewport.x
			const y = node.position.y * localViewport.zoom + localViewport.y
			return {
				...node,
				position: { x, y },
				width: (node.width || 150) * localViewport.zoom,
				height: (node.height || 40) * localViewport.zoom,
			}
		})
	}, [nodes, localViewport])

	// 计算边坐标
	const transformedEdges = useMemo(() => {
		return edges
			.map((edge) => {
				const sourceNode = nodes.find((node) => node.id === edge.source)
				const targetNode = nodes.find((node) => node.id === edge.target)

				if (!sourceNode || !targetNode) return null

				const sourceX =
					sourceNode.position.x * localViewport.zoom +
					localViewport.x +
					((sourceNode.width || 150) * localViewport.zoom) / 2
				const sourceY =
					sourceNode.position.y * localViewport.zoom +
					localViewport.y +
					((sourceNode.height || 40) * localViewport.zoom) / 2

				const targetX =
					targetNode.position.x * localViewport.zoom +
					localViewport.x +
					((targetNode.width || 150) * localViewport.zoom) / 2
				const targetY =
					targetNode.position.y * localViewport.zoom +
					localViewport.y +
					((targetNode.height || 40) * localViewport.zoom) / 2

				return {
					...edge,
					source: { x: sourceX, y: sourceY },
					target: { x: targetX, y: targetY },
				}
			})
			.filter(Boolean)
	}, [edges, nodes, localViewport])

	// 渲染Canvas
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		if (!ctx) return

		// 计算FPS
		const measureFps = () => {
			fpsCountRef.current++
			const now = performance.now()
			if (now - lastTimeRef.current >= 1000) {
				setFps(Math.round((fpsCountRef.current * 1000) / (now - lastTimeRef.current)))
				fpsCountRef.current = 0
				lastTimeRef.current = now
			}

			// 清除画布
			ctx.clearRect(0, 0, canvas.width, canvas.height)

			// 绘制网格背景
			drawGrid(ctx, localViewport)

			// 绘制边
			ctx.strokeStyle = "#b1b1b7"
			ctx.lineWidth = 1.5

			transformedEdges.forEach((edge) => {
				if (!edge) return

				ctx.beginPath()
				ctx.moveTo(edge.source.x, edge.source.y)

				// 简单的直线
				ctx.lineTo(edge.target.x, edge.target.y)

				ctx.stroke()
			})

			// 绘制节点
			transformedNodes.forEach((node) => {
				ctx.fillStyle = "#ffffff"
				ctx.strokeStyle = "#1a192b"
				ctx.lineWidth = 1

				// 绘制节点矩形
				ctx.beginPath()
				ctx.rect(node.position.x, node.position.y, node.width, node.height)
				ctx.fill()
				ctx.stroke()

				// 绘制节点文本
				ctx.fillStyle = "#222222"
				ctx.font = `${12 * localViewport.zoom}px Arial`
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.fillText(
					node.data?.label || node.id,
					node.position.x + node.width / 2,
					node.position.y + node.height / 2,
				)
			})

			animationFrameRef.current = requestAnimationFrame(measureFps)
		}

		animationFrameRef.current = requestAnimationFrame(measureFps)

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [transformedNodes, transformedEdges, size, localViewport])

	// 绘制网格
	const drawGrid = (ctx: CanvasRenderingContext2D, viewport: typeof localViewport) => {
		const gridSize = 20 * viewport.zoom
		const offsetX = viewport.x % gridSize
		const offsetY = viewport.y % gridSize

		ctx.strokeStyle = "#f0f0f0"
		ctx.lineWidth = 1

		// 绘制竖线
		for (let x = offsetX; x < size.width; x += gridSize) {
			ctx.beginPath()
			ctx.moveTo(x, 0)
			ctx.lineTo(x, size.height)
			ctx.stroke()
		}

		// 绘制横线
		for (let y = offsetY; y < size.height; y += gridSize) {
			ctx.beginPath()
			ctx.moveTo(0, y)
			ctx.lineTo(size.width, y)
			ctx.stroke()
		}
	}

	// 鼠标事件处理
	const handleMouseDown = (e: React.MouseEvent) => {
		setIsDragging(true)
		setDragStart({ x: e.clientX, y: e.clientY })
	}

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging) return

		const dx = e.clientX - dragStart.x
		const dy = e.clientY - dragStart.y

		setLocalViewport((prev) => ({
			...prev,
			x: prev.x + dx,
			y: prev.y + dy,
		}))

		setDragStart({ x: e.clientX, y: e.clientY })
	}

	const handleMouseUp = () => {
		setIsDragging(false)
	}

	// 滚轮缩放
	const handleWheel = (e: React.WheelEvent) => {
		e.preventDefault()

		const delta = e.deltaY < 0 ? 0.1 : -0.1
		const newZoom = Math.max(0.1, Math.min(2, localViewport.zoom + delta))

		// 计算鼠标位置相对于画布的坐标
		const rect = canvasRef.current?.getBoundingClientRect()
		if (!rect) return

		const mouseX = e.clientX - rect.left
		const mouseY = e.clientY - rect.top

		// 计算鼠标位置在原始坐标系中的位置
		const x = (mouseX - localViewport.x) / localViewport.zoom
		const y = (mouseY - localViewport.y) / localViewport.zoom

		// 计算新的viewport位置
		const newX = mouseX - x * newZoom
		const newY = mouseY - y * newZoom

		setLocalViewport({
			x: newX,
			y: newY,
			zoom: newZoom,
		})
	}

	return (
		<div
			ref={containerRef}
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: 10,
					left: 10,
					background: "white",
					padding: 10,
					borderRadius: 5,
					zIndex: 10,
					boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
				}}
			>
				<div>
					<strong>Canvas渲染 FPS:</strong> {fps} {fps < 30 ? "(低性能)" : ""}
				</div>
				<div>
					<strong>节点数量:</strong> {nodes.length}
				</div>
				<div>
					<strong>边数量:</strong> {edges.length}
				</div>
				<div>
					<strong>缩放:</strong> {Math.round(localViewport.zoom * 100)}%
				</div>
			</div>

			<canvas
				ref={canvasRef}
				width={size.width}
				height={size.height}
				style={{ display: "block" }}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onWheel={handleWheel}
			/>
		</div>
	)
}

export default CanvasRenderer
