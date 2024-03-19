import { Row } from "antd";
import styled from "styled-components";



export const TopRowWrapper = styled(Row)`
	position: relative;
    .json-schema-operator {
        
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
			gap: 10px;
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

	.editable-container {
		font-size: 14px;
	}
`