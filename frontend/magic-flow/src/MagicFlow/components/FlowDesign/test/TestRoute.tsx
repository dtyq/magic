// @ts-nocheck
import React from "react"
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom"
import PerformanceTest from "./PerformanceTest"
import CanvasRenderer from "./CanvasRenderer"
import ComparisonTest from "./ComparisonTest"

/**
 * 测试路由组件 - 提供各个测试页面的导航
 */
const TestRoute: React.FC = () => {
	return (
		<Router>
			<div
				style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}
			>
				<nav
					style={{
						padding: "15px",
						borderBottom: "1px solid #ddd",
						background: "#f5f5f5",
					}}
				>
					<h2 style={{ margin: "0 0 15px 0" }}>ReactFlow性能测试</h2>
					<div style={{ display: "flex", gap: "20px" }}>
						<Link to="/" style={linkStyle}>
							首页
						</Link>
						<Link to="/react-flow" style={linkStyle}>
							ReactFlow测试
						</Link>
						<Link to="/canvas" style={linkStyle}>
							Canvas测试
						</Link>
						<Link to="/comparison" style={linkStyle}>
							性能对比
						</Link>
					</div>
				</nav>

				<div style={{ flex: 1 }}>
					<Routes>
						<Route path="/" element={<HomePage />} />
						<Route path="/react-flow" element={<PerformanceTest />} />
						<Route path="/canvas" element={<CanvasRenderer nodes={[]} edges={[]} />} />
						<Route path="/comparison" element={<ComparisonTest />} />
					</Routes>
				</div>
			</div>
		</Router>
	)
}

// 首页组件
const HomePage: React.FC = () => {
	return (
		<div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
			<h1>ReactFlow 性能测试工具</h1>

			<div style={{ marginTop: "20px" }}>
				<h2>测试目的</h2>
				<p>
					本工具旨在帮助开发者诊断和比较ReactFlow在不同渲染模式下的性能差异。
					通过对比DOM渲染和Canvas渲染的性能，可以针对性地优化大型流程图的渲染效率。
				</p>
			</div>

			<div style={{ marginTop: "20px" }}>
				<h2>可用测试</h2>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "15px",
						marginTop: "10px",
					}}
				>
					<TestCard
						title="ReactFlow DOM渲染测试"
						description="测试原生ReactFlow的DOM渲染性能，支持动态调整节点数量和监控FPS。"
						link="/react-flow"
					/>

					<TestCard
						title="Canvas渲染测试"
						description="使用Canvas实现的流程图渲染，避免大量DOM节点创建，优化平移和缩放性能。"
						link="/canvas"
					/>

					<TestCard
						title="性能对比测试"
						description="并排展示ReactFlow和Canvas两种渲染方式，直观对比性能差异。"
						link="/comparison"
					/>
				</div>
			</div>

			<div style={{ marginTop: "30px" }}>
				<h2>测试建议</h2>
				<ul>
					<li>从少量节点开始测试，逐步增加节点数量直到性能明显下降</li>
					<li>测试中频繁进行平移和缩放操作，观察FPS变化</li>
					<li>比较两种渲染方式在处理大量节点时的性能差异</li>
					<li>尝试识别性能瓶颈出现的临界点（节点数量阈值）</li>
				</ul>
			</div>
		</div>
	)
}

// 测试卡片组件
const TestCard: React.FC<{
	title: string
	description: string
	link: string
}> = ({ title, description, link }) => {
	return (
		<div
			style={{
				border: "1px solid #ddd",
				borderRadius: "8px",
				padding: "15px",
				background: "#fff",
				boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
			}}
		>
			<h3 style={{ margin: "0 0 10px 0" }}>{title}</h3>
			<p style={{ margin: "0 0 15px 0", color: "#666" }}>{description}</p>
			<Link
				to={link}
				style={{
					display: "inline-block",
					padding: "8px 16px",
					background: "#4a90e2",
					color: "white",
					borderRadius: "4px",
					textDecoration: "none",
					fontWeight: "bold",
				}}
			>
				开始测试
			</Link>
		</div>
	)
}

// 链接样式
const linkStyle = {
	color: "#4a90e2",
	textDecoration: "none",
	fontWeight: "bold",
	padding: "5px 10px",
	borderRadius: "4px",
	transition: "background 0.2s",
	":hover": {
		background: "rgba(74, 144, 226, 0.1)",
	},
}

export default TestRoute
