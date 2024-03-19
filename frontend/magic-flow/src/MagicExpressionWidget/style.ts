/* eslint-disable no-nested-ternary */
import styled, { css } from "styled-components"
/** eslint-disable @typescript-eslint/consistent-type-imports */
import { ExpressionMode, TextAreaModePanelHeight } from "./constant"
import { LabelTypeMap, RenderConfig } from "./types";

export const EditWrapper = styled.div<{ disabled?: boolean; position: any; mode: ExpressionMode; renderConfig?: RenderConfig; maxHeight: number}>`
	width: 100%;
	position: relative;
	left: -0.5px;
    height: 100%;
	border: 1px solid transparent;
    display: flex;

	.magic-cascader-dropdown {
		left: ${p => p.mode === ExpressionMode.TextArea ? `${p.position.left}px!important` : `${p.position.left}px`}; 
		top: ${p => p.mode === ExpressionMode.TextArea ? `${Math.min(p.position.top, p.maxHeight)}px!important` : `${p.position.top}px`};
		overflow: ${p => p.renderConfig?.type === LabelTypeMap.LabelDateTime ? 'visible': 'hidden'};
	}

    .type-select {
        width: 84px;
        margin-right: 6px;
    }
	.selections {
		display: none;
		list-style-type: none;
		position: absolute;
		padding: 0;
		top: -18px;
		line-height: 1;
		right: -1px;
		font-size: 12px;
		border: 1px solid grey;
		border-radius: 3px;
		.option {
			padding: 2px 3px;
			cursor: pointer;
			&:hover,
			&.selected {
				background: #315cec;
				color: white;
			}
		}
	}
	.magic-tree-select {
		width: 100%;
		position: absolute;
		top: 0;
		z-index: -1;
		opacity: 0;
	}
`

export const TreeSelectWrapper = styled.div<{ height: number }>`
	.magic-tree-select {
		.magic-select-selector {
			height: ${(p) => p.height}px;
		}
	}
`

export const Edit = styled.div<{ disabled?: boolean; bordered?: boolean; mode: ExpressionMode, minHeight?: string; showMultipleLine: boolean}>`
	min-height: ${(p) =>
		p.minHeight ? p.minHeight : 
            p.mode === ExpressionMode.TextArea ? `${TextAreaModePanelHeight}px` : "100%"};
    overflow: auto;
	outline: none;
	height: ${p => !p.showMultipleLine ? "100%" : 'auto'};
	overflow: ${p => !p.showMultipleLine ? "hidden" : 'unset'};
	display: ${(p) => (p.mode === ExpressionMode.TextArea ? "block" : "flex")};
	align-items: center;
	flex-wrap: wrap;
	flex: 1;

	& > div[type="count"],
	& > div[type="node"] {
		display: inline-block;
	}
	& > span {
		white-space: break-spaces;
		word-break: break-all;
	}
	caret-color: ${(p) => (p.disabled ? "transparent" : "none")};
	cursor: ${(p) => (p.disabled ? "not-allowed" : "auto")};
`

export const InputExpressionStyle = styled.div<{
	disabled?: boolean
	bordered?: boolean
	isShowPlaceholder?: boolean
    placeholder?: string
    mode?: ExpressionMode
	showSwitch?: boolean
    maxHeight: string
}>`
	position: relative;
    .magic-mobile-cascader {
        flex: 1;
		position: relative;
		display: flex;
		align-items: center;
		min-height: 32px;
		outline: 0;
		border-radius: 8px;
		background-color: #FFFFFF;

    }
	.editable-container {
		width: calc(100% - 70px - 6px);
        font-size: 14px;
        flex: 1;
		position: relative;
		display: flex;
		align-items: flex-start;
		min-height: 32px;
        max-height: ${p => p.maxHeight};
        overflow-y: scroll;
        overflow-x: hidden;
		padding: 4px 10px;
		outline: 0;
		border-radius: 8px;
		transition: all 300ms ease 0ms;
        color: ${(p) => (p.disabled ? "#1c1d2359" : "#1c1d23")};
		background-color: #FFFFFF;
        border: 1px solid #1C1D2314;

		// 当是Common时，需要+左侧的下拉宽度
		&+div {
            bottom: auto!important;
            overflow: auto;
            top: ${p => p.mode === ExpressionMode.Common ? `100%!important` : 'auto'};
            z-index: 1;
            .magic-cascader-dropdown {
                left: ${p => p.mode === ExpressionMode.Common && p.showSwitch ? `90px!important` : p.mode === ExpressionMode.Common && !p.showSwitch ? "0!important" : 'auto'};
				top: ${p => p.mode === ExpressionMode.Common ? `0!important` : 'auto'};
            }
        }


		${(p) =>
			!p.disabled &&
			css`
				&:hover {
					border-color: #315cec;
					border-right-width: 1px !important;
				}
			`}

		&::after {
			content: "${(p) => (p.isShowPlaceholder ? p.placeholder : "")}";
			color: #1C1D2359;
			opacity: 0.85;
			display: block;
			position: absolute;
            max-width: calc(100% - 14px);
            overflow: hidden;
            text-overflow: ellipsis;
            text-wrap: ${p => p.mode === ExpressionMode.TextArea ? 'wrap' : 'nowrap'};
			left: 10px;
            top: 4px;
            line-height: 22px;
			pointer-events: none;
		}
	}


	.only-one-line {
		max-height:32px;
		overflow: hidden; 
		display: flex;
		align-items: flex-start;
	}

    .type-select {
        height: 32px;
    }
`

export const LabelFuncStyle = styled.div<{
	disabled?: boolean
	bordered?: boolean
	selected?: boolean
}>`
	display: inline-block;
	background-color: ${(p) => (p.disabled ? "#d3d3d3" : p.selected ? "rgb(245 248 255)" : "white")};
	color: ${(p) => (p.selected ? "black" : "black")};
	border-radius: 4px;
	padding: 1px 5px;
	margin: 0 2px;
	cursor: ${(p) => (p.disabled ? "not-allowed" : "default")};
    border: ${p => p.selected ? "1px solid rgb(132 173 255)" : "1px solid rgba(0,0,0,.05)"};
    font-size: 12px;
	display: inline-flex;
    align-items: center;
    // text-wrap: nowrap;
    overflow: auto;
	span {
		/* user-select: none; */
	}
		
	&.selected {
		background:rgb(245 248 255);
	}
		
    .semi-icon-close {
        flex: 12px;
        color: #1C1D2359;
        display: flex;
        align-items: center;
        margin-left: 6px;
        font-size: 12px;
        cursor: pointer;
        &:hover {
            color: #1c1d23;
        }

    }

    // .text {
    //     flex: 1;
    //     text-wrap: nowrap;
    //     text-overflow: ellipsis;
    //     overflow: hidden;
    // }
    // .args {
    //     flex: 1;
    //     text-wrap: nowrap;
    //     text-overflow: ellipsis;
    //     overflow: hidden;
    // }
		
`
export const LabelNodeStyle = styled.div<{
	disabled?: boolean
	bordered?: boolean
	selected?: boolean
    wrapperWidth: number
    isError: boolean
}>`
	max-width: calc(100% - 10px);
	display: inline-flex;
    align-items: center;
	background-color: ${(p) => (p.isError? "rgb(253, 226, 226)" : p.disabled ? "#d3d3d3" : p.selected ? "rgb(245 248 255)" : "white")};
	color: ${(p) => (p.isError ? "#FF4D3A" : p.selected ? "white" : "black")};
	border-radius: 4px;
	padding: 1px 5px;
	margin: 0px 2px;
	white-space: break-spaces;
	word-break: break-all;
    line-height: 16px;
	cursor: ${(p) => (p.disabled ? "not-allowed" : "default")};
    border: ${p => p.selected ? "1px solid rgb(132 173 255)" : "1px solid rgba(0,0,0,.05)"};
    font-size: 12px;

	&.selected {
		background:rgb(245 248 255);
		.app-info {
			pointer-events: none;
		}
		.splitor {
			pointer-events: none;
		}
		.field-label {
			pointer-events: none;
		}
		.field-type {
			pointer-events: none;
		}
	}

    .app-info {
		pointer-events: none;
        color: #1C1D23CC;
        display: flex;
        align-items: center;
        .app-icon {
            margin-right: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            svg {
                // padding: 1px;
                width: 14px;
                height: 14px;
                stroke: #1C1D23CC;
            }
        }
        .app-name {
			pointer-events: none;
            display: inline-block;
            max-width: ${p => p.wrapperWidth * 0.2}px;
            overflow: hidden;
            text-overflow: ellipsis;
            text-wrap: nowrap;
        }
    }

    .splitor {
		pointer-events: none;
        margin: 0 4px;
        color: #1C1D2359;
    }

    .field-label {
	
		pointer-events: none;
        color: #315CEC;
        margin-right: 4px;
        display: flex;
        align-items: center;
        padding: 0 1px;
        .icon-variable {
            width: 14px;
            height: 14px;
            margin-right: 2px;
        }
        .title {
            max-width: ${p => p.wrapperWidth * 0.3}px;
            overflow: hidden;
            text-overflow: ellipsis;
            text-wrap: nowrap;
        }

    }

    .field-type {
	
		pointer-events: none;
        color: #1C1D2359;
        padding: 0 1px;
        
        max-width: ${p => p.wrapperWidth * 0.2}px;
        overflow: hidden;
        text-overflow: ellipsis;
        text-wrap: nowrap;
    }

    .semi-icon-close {
        color: #1C1D2359;
        display: flex;
        align-items: center;
        margin-left: 6px;
        font-size: 12px;
        cursor: pointer;
        &:hover {
            color: #1c1d23;
        }

    }
`
export const LabelTextStyle = styled.div`
	display: inline-block;
	padding: 0 4px;
	margin: 4px 2px;
	white-space: break-spaces;
	word-break: break-all;
`

export const PopoverModalStyle = styled.div`
	margin-top: 20px;
	height: 180px;
	z-index: 1073;
`

export const FuncTipsStyle = styled.div`
	max-width: 300px;

	.func-content {
		border-bottom: 1px #959595 solid;
		padding-bottom: 10px;
		& > div {
			padding-bottom: 10px;
		}
		.func-title {
			font-weight: 600;
			font-size: 18px;
            overflow: hidden;
            text-overflow: ellipsis;
		}
		.func-return {
		}
		.func-desc {
			height: 80px;
			color: #959595;
			overflow-x: none;
			overflow-y: auto;
			&::-webkit-scrollbar {
				width: 6px;
				height: 6px;
				background-color: #ffffff;
				-webkit-appearance: none;
			}

			&::-webkit-scrollbar-track {
				width: 4px;
				background-color: #ffffff;
			}

			&::-webkit-scrollbar-thumb {
				background-color: rgba(33, 33, 33, 0);
				border-radius: 4px;
				cursor: move;
				transition: all linear 0.1s;
			}
			&:hover {
				&::-webkit-scrollbar-thumb {
					background-color: rgba(33, 33, 33, 0.1);
				}
			}
		}
	}

	.args-content {
		padding-top: 10px;
		& > div {
			padding: 10px 0;
		}
		.args-title {
			font-weight: 500;
		}
		.args-desc {
			.field-type {
				color: #c1c85c;
			}
		}
		.desc {
			display: block;
			max-height: 40px;
			color: #959595;
			overflow-x: none;
			overflow-y: auto;
			&::-webkit-scrollbar {
				width: 6px;
				height: 6px;
				background-color: #ffffff;
				-webkit-appearance: none;
			}

			&::-webkit-scrollbar-track {
				width: 4px;
				background-color: #ffffff;
			}

			&::-webkit-scrollbar-thumb {
				background-color: rgba(33, 33, 33, 0);
				border-radius: 4px;
				cursor: move;
				transition: all linear 0.1s;
			}
			&:hover {
				&::-webkit-scrollbar-thumb {
					background-color: rgba(33, 33, 33, 0.1);
				}
			}
		}
	}
`
