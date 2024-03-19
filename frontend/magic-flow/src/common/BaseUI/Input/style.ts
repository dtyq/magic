import { createGlobalStyle } from "styled-components"

export const InputGlobalStyle = createGlobalStyle`

    ::placeholder {
        color: #1C1D2359 !important;
    }
    .magic-input-affix-wrapper,.magic-input {
		border-color: #eee;
        height: 32px;
        padding: 0 9px;
        border-radius: 8px;
		color: #333;
		background-color: #fff;
		&:hover {
			border-color: #3B81F7;
			background-color: #fff;
		}
		&:focus {
			border-color: #3B81F7;
		}
    }


    .magic-input-affix-wrapper:not(.magic-input-affix-wrapper-disabled):hover {
		background-color: #fff;
    }
`