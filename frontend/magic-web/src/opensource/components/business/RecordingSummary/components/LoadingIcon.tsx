import React from "react"

interface LoadingIconProps {
	size?: number
	color?: string
	style?: React.CSSProperties
}

function LoadingIcon({ size = 20, style, color = "rgba(49, 92, 236, 1)" }: LoadingIconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			className="animate-spin"
			style={{ ...style, animationDuration: "0.6s" }}
		>
			<mask id="path-1-inside-1_3886_139816" fill="white">
				<path d="M20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10Z" />
			</mask>
			<g
				clipPath="url(#paint0_angular_3886_139816_clip_path)"
				data-figma-skip-parse="true"
				mask="url(#path-1-inside-1_3886_139816)"
			>
				<g transform="matrix(0 0.01 -0.01 0 10 10)">
					<foreignObject x="-1400" y="-1400" width="2800" height="2800">
						<div
							{...({
								xmlns: "http://www.w3.org/1999/xhtml",
							} as React.HTMLAttributes<HTMLDivElement>)}
							style={{
								background: `conic-gradient(from 90deg,rgba(255, 255, 255, 0) 0deg,${color} 360deg)`,
								height: "100%",
								width: "100%",
								opacity: 1,
							}}
						></div>
					</foreignObject>
				</g>
			</g>
			<path
				d="M20 10H16C16 13.3137 13.3137 16 10 16V20V24C17.732 24 24 17.732 24 10H20ZM10 20V16C6.68629 16 4 13.3137 4 10H0H-4C-4 17.732 2.26801 24 10 24V20ZM0 10H4C4 6.68629 6.68629 4 10 4V0V-4C2.26801 -4 -4 2.26801 -4 10H0ZM10 0V4C13.3137 4 16 6.68629 16 10H20H24C24 2.26801 17.732 -4 10 -4V0Z"
				data-figma-gradient-fill='{"type":"GRADIENT_ANGULAR","stops":[{"color":{"r":1.0,"g":1.0,"b":1.0,"a":0.0},"position":0.0},{"color":{"r":0.19215686619281769,"g":0.36078432202339172,"b":0.92549020051956177,"a":1.0},"position":1.0}],"stopsVar":[{"color":{"r":1.0,"g":1.0,"b":1.0,"a":0.0},"position":0.0},{"color":{"r":0.19215686619281769,"g":0.36078432202339172,"b":0.92549020051956177,"a":1.0},"position":1.0}],"transform":{"m00":1.1802814585057386e-12,"m01":-20.0,"m02":20.0,"m10":20.0,"m11":-9.3802396405884281e-13,"m12":9.3802396405884281e-13},"opacity":1.0,"blendMode":"NORMAL","visible":true}'
				mask="url(#path-1-inside-1_3886_139816)"
			/>
			<defs>
				<clipPath id="paint0_angular_3886_139816_clip_path">
					<path
						d="M20 10H16C16 13.3137 13.3137 16 10 16V20V24C17.732 24 24 17.732 24 10H20ZM10 20V16C6.68629 16 4 13.3137 4 10H0H-4C-4 17.732 2.26801 24 10 24V20ZM0 10H4C4 6.68629 6.68629 4 10 4V0V-4C2.26801 -4 -4 2.26801 -4 10H0ZM10 0V4C13.3137 4 16 6.68629 16 10H20H24C24 2.26801 17.732 -4 10 -4V0Z"
						mask="url(#path-1-inside-1_3886_139816)"
					/>
				</clipPath>
			</defs>
		</svg>
	)
}

export default LoadingIcon
