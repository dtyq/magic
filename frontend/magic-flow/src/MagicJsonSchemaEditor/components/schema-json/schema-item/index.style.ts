import { Row, RowProps } from "antd";
import { childFieldGap } from "@/MagicJsonSchemaEditor/constants";
import styled from "styled-components";


export const SchemaItemWrap = styled.div`
    position: relative;
    .json-schema-operator {
		gap: 10px;
        
        .anticon {
            font-size: 15px;   
            padding: 8px;
        }
        .add,.delete {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 32px;
            width: 32px;
            background: #2E2F380D;
            border-radius: 8px; 
            &:hover {
                opacity: 0.8;
            }
        }
        .add {
            .anticon {
                color: #315CEC;
            }
        }
        .delete {
            .anticon {
                color: #1C1D2399;
            }
        }

    }
	.json-schema-field-check {
		width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		padding-top: 10px;
		padding-left: 6px;
		.magic-checkbox-inner,input {
			width: 14px;
			height: 14px;
		}
	}
`



interface SchemaItemRowProps extends RowProps {
    // 当前行距离左侧的距离
    leftGap: number
	// 是否显示checkbox
	showExportCheckbox: boolean
}

export const SchemaItemRow = styled(Row)<SchemaItemRowProps>`
    position: relative;
    gap: 10px;
    >.magic-col {
        margin: 0!important;
        &:not(:first-child) {
            padding: 0!important;
        }

        &:first-child {
            padding-left: ${p => p.leftGap}px!important;
        }

		&:nth-child(2) {
			padding-left ${p => p.showExportCheckbox ? p.leftGap : 0}px!important;
		}
    }
`