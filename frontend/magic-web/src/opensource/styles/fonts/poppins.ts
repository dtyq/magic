import "@fontsource/poppins/300.css"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/600.css"
import "@fontsource/poppins/900.css"
import { useEffect } from "react"

const poppinsFontStyles = `
	@font-face {
		font-family: 'Poppins';
		font-style: normal;
		font-weight: 300;
		font-display: swap;
		src: local('Poppins Light');
	}

	@font-face {
		font-family: 'Poppins';
		font-style: normal;
		font-weight: 400;
		font-display: swap;
		src: local('Poppins');
	}

	@font-face {
		font-family: 'Poppins';
		font-style: normal;
		font-weight: 600;
		font-display: swap;
		src: local('Poppins SemiBold');
	}

	@font-face {
		font-family: 'Poppins';
		font-style: normal;
		font-weight: 900;
		font-display: swap;
		src: local('Poppins Black');
	}
`

let isLoaded = false
let styleElement: HTMLStyleElement | null = null

function usePoppinsFont() {
	useEffect(() => {
		if (isLoaded) return

		styleElement = document.createElement("style")
		styleElement.setAttribute("data-font", "poppins")
		styleElement.textContent = poppinsFontStyles
		document.head.appendChild(styleElement)

		isLoaded = true
	}, [])
}

export default usePoppinsFont
