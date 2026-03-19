import { Languages } from "./components/LanguageSelect/constants"

export const defaultCodeMap: Record<string, string> = {
	[Languages.Php]:
		"<?php\n// Example: Convert the string-type input to an array-type output\n// Tutorials: https://www.w3schools.com/php/\n\n$output = explode(',', $input);\n\nreturn [\n    'output' => $output\n];",
	[Languages.Python]:
		"# Example: Convert the string-type input to an array-type output\n# Tutorials: https://www.w3schools.com/python/\n\noutput = input.split(',')\n\nreturn {'output': output}",
}
