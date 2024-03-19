import { createLucideIcon, type IconNode } from "./createLucideIcon"

const magiClawIconNode: IconNode = [
	[
		"path",
		{
			key: "magi-claw-0",
			d: "M10 10C11 8.33333 8.39572 8.29167 7.66667 7.66667C6.86988 6.9836 9.96915 7.04905 10 6C10.0171 5.41809 9.25502 4.74498 9.66667 4.33333C10 4 12.1237 3.5 12.1237 3C12.1237 2.5 10.6667 2 8.99923 2C6.23823 2 4 4.23858 4 7C4 9.76142 6.23823 12 8.99923 12C11.7602 12 13.9985 9.76142 13.9985 7C13.9985 6.47917 13.9997 5.58333 12 7.33333M8 12L5.66667 14C5.66667 14 4.71596 12.4477 4 11.6667C3.28404 10.8856 2 10 2 10L3.66667 8.66667",
		},
	],
]

export const MagiClaw = createLucideIcon("magi-claw", magiClawIconNode, {
	viewBox: "0 0 16 16",
	defaultSize: 16,
	defaultStrokeWidth: 1.25,
})

export const MagiClawIcon = MagiClaw
export const LucideMagiClaw = MagiClaw

export default MagiClaw
