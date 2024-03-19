import styled from "styled-components"
import { RELATION_LOGICS_MAP } from "./constants"

export const CustomConditionContainerStyle = styled.div`
	width: 100%;
	margin-left: 0;
`

interface RelationGroupStyleProps {
	isShowRelationSign: boolean
	operands: RELATION_LOGICS_MAP
}

export const RelationGroupStyle = styled.div<RelationGroupStyleProps>`
	min-height: 50px;
	position: relative;
	margin-bottom: ${(p) => (p.isShowRelationSign ? "27px" : 0)};

	&::before {
		opacity: ${(p) => (p.isShowRelationSign ? 1 : 0)};
		z-index: 1;
		position: absolute;
		left: 14px;
		content: "";
		display: inline-block;
		height: 100%;
		border-style: dashed;
		border-width: 0 0 0 1.3px;
		border-color: ${(p) => (p.operands === RELATION_LOGICS_MAP.AND ? "#315CEC" : "#FF7D00")};
	}

	& > .relation-group {
		& > .relation-sign {
			position: absolute;
			top: calc(50% - 10px);
			z-index: 2;
			height: 20px;
			width: 20px;
			left: 5px;
			border-radius: 4px;
			padding: 2px 8px;
			display: flex;
			justify-content: center;
			align-items: center;
			cursor: pointer;
			background: ${(p) => (p.operands === RELATION_LOGICS_MAP.AND ? "#EEF3FD" : "#FFF8EB")};
			color: ${(p) => (p.operands === RELATION_LOGICS_MAP.AND ? "#315CEC" : "#FF7D00")};
			user-select: none;
			font-size: 12px;
		}
		& > .add {
			position: absolute;
			bottom: -24px;
			height: 20px;
			width: 20px;
			display: flex;
			justify-content: center;
			align-items: center;
			left: 5px;

			.icon {
				font-size: 20px;
				color: ${(p) => (p.operands === RELATION_LOGICS_MAP.AND ? "#315CEC" : "#FF7D00")};
				cursor: pointer;
			}
		}
	}
	.conditions {
		margin-left: 30px;
		padding-bottom: 1px;
		&.only-root {
			margin-left: 0;
		}

		.condition_vertical_row,
		.condition_vertical_panel {
			margin-bottom: 10px;
		}

		.relation-item:last-child {
			.condition_vertical_row,
			.condition_vertical_panel {
				margin-bottom: 0;
			}
		}
	}
`

export const RelationItemStyle = styled.div`
	display: inline-block;
	width: 100%;
	height: auto;
	overflow: visible;

	.condition_vertical_fields {
		position: relative;
		display: flex;
		flex: none;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		&::-webkit-scrollbar {
			width: 6px;
			height: 6px;
			background-color: inherit;
			-webkit-appearance: none;
		}

		&::-webkit-scrollbar-track {
			width: 4px;
			background-color: inherit;
		}

		&::-webkit-scrollbar-thumb {
			background-color: rgba(33, 33, 33, 0);
			border-radius: 0;
			cursor: move;
			transition: all linear 0.1s;
		}
		&:hover {
			&::-webkit-scrollbar-thumb {
				background-color: rgba(33, 33, 33, 0.1);
			}
		}
	}

	.condition_vertical_row {
		position: relative;
		display: flex;
		flex-direction: row;
		width: 100%;
		margin-left: 1px;
		&.card {
			display: block;
			border: 1px solid #315cec;
			border-radius: 3px;
			padding: 0 10px;
			margin-right: 10px;
			margin-top: 5px;
			.condition_vertical_col {
				margin: 10px 0;
				.condition_fields-item {
					padding: 0;
				}
			}
		}
	}
	.right-condition_operations {
		.title {
			font-size: 12px;
			line-height: 16px;
			color: #1c1d2399;
			margin-bottom: 6px;
			visibility: hidden;
		}
		.condition_vertical_panel {
			flex: 70px;
			display: flex;
			.anticon {
				font-size: 15px;
				padding: 8px;
				cursor: pointer;
			}
			.add-icon,
			.delete-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				height: 32px;
				width: 32px;
				background: #2e2f380d;
				border-radius: 8px;
				&:hover {
					opacity: 0.8;
				}
			}
			.add-icon {
				.anticon {
					color: #315cec;
				}
			}
			.delete-icon {
				.anticon {
					color: #1c1d2399;
				}
				margin-left: 10px;
			}
		}
	}

	.condition_vertical_col {
		flex: 1;
		width: 100%;
		& > .condition_fields-item {
			padding-right: 10px;
			> .title {
				font-size: 12px;
				line-height: 16px;
				color: #1c1d2399;
				margin-bottom: 6px;
			}
		}
		& > .condition_fields-item > .noMarginBottom {
			margin-bottom: 0 !important;
		}
		& > .condition_fields-item > .magic-row > .magic-col-24 {
			width: 100% !important;
			max-width: 100% !important;
			padding-right: 0 !important;
		}

		&.left,
		&.right {
			flex: 40%;
			min-height: 32px;
		}

		&.compare {
			flex: 15%;
			min-height: 32px;
		}
	}
`
