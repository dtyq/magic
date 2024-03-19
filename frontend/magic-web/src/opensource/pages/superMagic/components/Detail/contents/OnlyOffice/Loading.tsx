function Loading() {
	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: "rgba(0, 0, 0, 0.3)",
				backdropFilter: "blur(2px)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 9999,
			}}
		>
			<div
				style={{
					width: "40px",
					height: "40px",
					border: "4px solid rgba(24, 144, 255, 0.2)",
					borderTopColor: "#1890ff",
					borderRadius: "50%",
					animation: "spin 1s linear infinite",
				}}
			/>
			<style>
				{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
			</style>
		</div>
	)
}

export default Loading
