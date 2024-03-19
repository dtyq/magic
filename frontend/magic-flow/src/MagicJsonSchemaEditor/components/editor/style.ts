import styled from "styled-components"


export const JsonSchemaEditorWrap = styled.div`

    color: #1C1D2399;

	
	.magic-input-group-wrapper {
		&:hover {
			background: transparent;
			.magic-input-group-addon {
				background: rgba(46, 47, 56, 0.04);
				cursor: pointer;
				&:hover {
					background: rgba(46, 47, 56, 0.04)!important;
					opacity: 0.9;
				}
			}
		}
	}

	.add-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #2E2F380D;
		padding: 6px 11px 6px 11px;
		gap: 2px;
		border-radius: 6px;
		cursor: pointer;
		margin-top: 10px;
		color: #1C1D23CC;
		&:hover {
			opacity:0.8;
		}
	}
        
    .json-schema-header {
        height: 16px;
        font-size: 12px;
        padding-bottom: 2px;
        gap: 10px;
        
        .add-icon {
            padding: 2px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            width: 20px;

            &:hover {
                background-color: #2E2F380D;
            }
        }
		.json-schema-field-check {
			width: 14px;
			height: 14px;
			display: flex;
			align-items: center;
			padding-left: 6px;
			visibility: hidden;
			.magic-checkbox-inner,input {
				width: 14px;
				height: 14px;
			}
		}
    }


    .json-schema-operator {
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
        display: flex;
        align-items: center;
        // margin-left: -25px;
        cursor: pointer;
        
    }
`
