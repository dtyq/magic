import { describe, expect, it } from "vitest"
import { buildConcatenatedPresetContent } from "../utils"
import type { FieldItem } from "../types"

describe("MainInputContainer panel utils", () => {
	it("builds mixed preset content per field instead of switching logic for the whole list", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				current_value: "Oil painting",
				options: [],
				preset_content: { default: "Style: {preset_value}" },
			},
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
			{
				data_key: "camera",
				label: { default: "Camera" },
				current_value: "close-up",
				options: [
					{
						value: { default: "close-up", en_US: "close-up" },
					},
				],
			},
			{
				data_key: "mood",
				label: { default: "Mood" },
				current_value: "calm",
				options: [],
				preset_content: { default: "Mood: {preset_value}" },
			},
		]

		expect(buildConcatenatedPresetContent(fields, "en_US")).toBe(
			"Style: Oil painting,Lighting: soft,Camera: close-up,Mood: calm.",
		)
	})

	it("keeps the original fallback sentence when no field has preset_content", () => {
		const fields: FieldItem[] = [
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
			{
				data_key: "camera",
				label: { default: "Camera" },
				current_value: "close-up",
				options: [
					{
						value: { default: "close-up", en_US: "close-up" },
					},
				],
			},
		]

		expect(buildConcatenatedPresetContent(fields, "en_US")).toBe(
			"Lighting: soft,Camera: close-up.",
		)
	})

	it("skips fields with preset_content when current_value is undefined", () => {
		const fields: FieldItem[] = [
			{
				data_key: "style",
				label: { default: "Style" },
				options: [],
				preset_content: { default: "Style: {preset_value}" },
			},
			{
				data_key: "lighting",
				label: { default: "Lighting" },
				current_value: "soft",
				options: [
					{
						value: { default: "soft", en_US: "soft" },
					},
				],
			},
		]

		expect(buildConcatenatedPresetContent(fields, "en_US")).toBe("Lighting: soft.")
	})
})
