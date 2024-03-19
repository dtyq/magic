import styled, {createGlobalStyle} from "styled-components"

export const GlobalStyle = createGlobalStyle`
    
    .magic-select-item-option-selected:not(.magic-select-item-option-disabled) {
        background-color: #fff;
        color: #3B81F7;
    }
    .magic-select-item-option-active:not(.magic-select-item-option-disabled) {
        background-color: #F5F9FF;
        color: #3B81F7;
    }
    .magic-select-item-option-selected:not(.magic-select-item-option-disabled) .magic-select-item-option-content,
    .magic-select-item-option-content {
        padding-left: 0;
    }
    .magic-select-item-option-state {
        display: none;
    }
    .magic-select-item-option-selected:not(.magic-select-item-option-disabled) {
        background-color: #fff;
    }

    .magic-select, ant-mobile-select {
        min-height: 32px;
		color: #333333;
		&:hover {
            .magic-select-selector {
                border-color: #3B81F7!important;
            }
		}

        
        .magic-select-selector {
            position: relative!important;
            background-color: #fff!important;
            border: 1px solid #1C1D2314!important;
            border-radius: 8px!important;
            min-height: 33px!important;
        }
        .magic-select-selection-item {
            padding-right: 14px;
            display: flex;
            align-items: center;
            padding-right: 0!important;
            margin-right: 18px;
            text-overflow: ellipsis;
        }
        .magic-select-arrow {
            color: #1C1D2359;
            svg {
                width: 16px;
                height: 16px;
            }
        }

    }

    .magic-select-disabled {
        
        .magic-select-selector {
            background: #EEEEEE;  
            color: #999999;
            border-color: #d9d9d9;
        }
        .magic-select-arrow {  
            .default-suffix-icon {
                color: #999999;
            }
        }
    }

    &.magic-select-multiple .magic-select-selector {
		padding: 1px 4px;

    }

`

export const SelectWrapper = styled.div`
`

