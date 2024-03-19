import styled from "styled-components";

export const RendererWrapper = styled.div`
    
    .search-wrapper {
        padding: 4px;
		.magic-input {
			height: 100%;
		}
    }

    .dropdown-list {
        max-height: 200px;
        overflow: auto;
        margin: 0 4px;
        .dropdown-item {
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            height: 30px;
            border-radius: 8px;
            cursor: pointer;
            position: relative;

            &:last-child {
                margin-bottom: 0;
            }
            .anticon {
                width: 30px;
                height: 30px;
                margin-right: 2px;
                display: flex;
                align-items: center;
                justify-content: center;

                svg {
                    width: 18px;
                    height: 18px;
                }
            }
            .label {
                font-size: 14px;
                line-height: 20px;
                color: #1C1D23;
                &>div {
                    display: flex;
                    align-items: center;
                }
            }
            &:hover {
                background: #EEF3FD;
            }

            .tick {
                position: absolute;
                right: 7px;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #315CEC;
            }
        }
    }
`