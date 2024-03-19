import styled from "styled-components"

export const Wrap = styled.div`
	width: 400px;
	min-height: 320px;
	.magic-popover-inner-content {
		padding: 0;
	}
	.title {
		padding: 10px;
		color: #999999;
		margin-bottom: 0;
		user-select: none;
		border-bottom: 1px solid #d9d9d9;
	}
	ul {
		margin: 0!important;
		height: 270px;
		padding: 0;
    	overflow: auto;
		.no-option {
			color: #8f959e;
			padding-left: 10px;
			padding-top: 10px;
		}
		li {
			display: flex!important;
			padding: 10px!important;
			justify-content: space-between!important;
			align-items: center!important;
			color: #333333!important;
			height: 42px;
			overflow: hidden;
			.anticon {
				font-size: 18px!important;
				line-height: none;
			}
			.select, .next {
				display: none;
				padding-left: 5px;
				border-radius: 4px;
				user-select: none;
			}
			.arguments-input {
				display: none;
				margin-right: 4px;
			}
			.next {
				flex: 0 0 55px;
			}
			.select {
				flex: 0 0 60px;
				text-align: center;
				margin-right: 5px;
                width: 60px;
			}
			& > span:first-child {
				display: flex;
				align-items: center;
				width: calc(100% - 55px);
				.anticon {
					margin-right: 5px;
				}
				.text {
					white-space: nowrap;
					width: 100%;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}
		}
		li:hover   {
			.arguments-input {
				display: flex;
			}
			.select {
				display: flex;
				align-items: center;
				color: white!important;
				background: #3370FF;
				justify-content: center;

			}
		}
		.select:hover {
			opacity: 0.8;
		}

		li:hover .next {
			display: flex;
			align-items: center;
			color: #3B81F7!important;
			justify-content: space-between;
		}
		.next:hover {
			background: #DAE1F0;
		}
		li:hover {
			background: rgba(31,35,41, 0.08);
		}
	}
	.magic-icon {
			margin-right: 6px;
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 3px;
			color: #333333;

			svg {
				height: 18px;
				width: 18px;
			}
		}
	.footer {
		display: flex;
		justify-content: flex-end;
		button {
			margin-right: 10px;
			margin-bottom: 10px;
		}
	}

`
