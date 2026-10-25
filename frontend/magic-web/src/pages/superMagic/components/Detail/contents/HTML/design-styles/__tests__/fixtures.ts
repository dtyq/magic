import type { DesignStyle } from "../catalog"

export const designStyleFixture: DesignStyle = {
	code: "fixture-style",
	title: "Fixture Style",
	description: "A lightweight style fixture for tests.",
	category: "design",
	tags: ["design", "fixture"],
	preview: { layout: "poster" },
	featured: true,
	design: {
		colors: [{ name: "primary", value: "#111827" }],
		typography: [{ name: "body", fontFamily: "Inter", fontSize: "16px" }],
		spacing: [{ name: "sm", value: "8px" }],
		rounded: [{ name: "md", value: "8px" }],
		components: [],
		sections: { Overview: "A lightweight fixture." },
	},
}
