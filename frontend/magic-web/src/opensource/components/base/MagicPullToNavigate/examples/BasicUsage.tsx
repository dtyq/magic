import React, { useState } from "react"
import MagicPullToNavigate from "../index"

function BasicUsageExample() {
	const [logs, setLogs] = useState<string[]>([])

	const addLog = (message: string) => {
		const timestamp = new Date().toLocaleTimeString()
		setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
	}

	const handleNavigate = async () => {
		addLog("Navigation triggered - starting async operation")
		// Simulate async navigation
		await new Promise((resolve) => setTimeout(resolve, 1000))
		addLog("Navigation completed")
	}

	const handlePullStart = () => {
		addLog("Pull gesture started")
		// You can add haptic feedback, analytics tracking, etc.
	}

	const handlePullEnd = (success: boolean) => {
		addLog(`Pull gesture ended - ${success ? "Navigation triggered" : "Navigation cancelled"}`)
		// Clean up any temporary states, stop animations, etc.
	}

	const clearLogs = () => {
		setLogs([])
	}

	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<div style={{ padding: "20px", background: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
				<h2>MagicPullToNavigate Example</h2>
				<p>Pull down from the top to trigger navigation</p>
				<button onClick={clearLogs} style={{ marginBottom: "10px" }}>
					Clear Logs
				</button>
				<div
					style={{
						background: "white",
						padding: "10px",
						borderRadius: "4px",
						maxHeight: "150px",
						overflowY: "auto",
						fontSize: "12px",
						fontFamily: "monospace",
					}}
				>
					{logs.length === 0 ? (
						<div style={{ color: "#999" }}>No events yet...</div>
					) : (
						logs.map((log, index) => (
							<div key={index} style={{ marginBottom: "2px" }}>
								{log}
							</div>
						))
					)}
				</div>
			</div>

			<MagicPullToNavigate
				onNavigate={handleNavigate}
				onStart={handlePullStart}
				onEnd={handlePullEnd}
				threshold={80}
				maxDistance={200}
				texts={{
					pullDown: "Pull down to go back",
					releaseToNavigate: "Release to navigate",
					navigating: "Navigating...",
				}}
			>
				<div
					style={{
						padding: "20px",
						height: "100%",
						background: "white",
						overflowY: "auto",
					}}
				>
					<h3>Main Content Area</h3>
					<p>This is the main content that can be scrolled.</p>
					<p>Pull down from the very top to trigger the navigation gesture.</p>

					{/* Add some content to make it scrollable */}
					{Array.from({ length: 50 }, (_, i) => (
						<p key={i}>
							Content item {i + 1} - Lorem ipsum dolor sit amet, consectetur
							adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore
							magna aliqua.
						</p>
					))}
				</div>
			</MagicPullToNavigate>
		</div>
	)
}

export default BasicUsageExample
