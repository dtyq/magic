import styled, { createGlobalStyle } from "styled-components";

export const RendererGlobalStyle = createGlobalStyle`
    .magic-select-dropdown {
        padding: 0;
        min-width: 250px!important;
    }
	.magic-tree-list {
		max-height: 350px;
		overflow: scroll;
	}
`

export const RendererWrapper = styled.div`
    max-width: 250px;
    .search-wrapper {
        padding: 4px;
		.magic-input {
			height: 100%;
		}
        .title {
            margin: 0 8px;
        }
        .search {
            padding: 0;
            border-bottom: none;
        }
    }
    .magic-popover-inner-content {
        padding: 0;
    }
    .site-tree-search-value {
        color: #32c436;
    }

    .magic-tree {
        color: #1C1D23;
        margin: 0 4px;
        .magic-tree-switcher {
            width: 12px;
            height: 100%;
            margin-left: 4px;
        }
        .magic-tree-treenode {
            margin: 0 0 4px 0;
            padding: 0;
            border-radius: 8px;
            position: relative;

            &:hover {
                background: #EEF3FD;
            }

            &.is-application {
                .magic-tree-node-content-wrapper {
                    color: #1C1D23;
                }
            }
            .tabler-icon-chevron-right {
                color: #1C1D2359;
            }

			&.is-variable {
                .magic-tree-node-content-wrapper {
                    color: #FF7D00;
				}
			}
            
            .magic-tree-node-content-wrapper {
                color: #315CEC;
                display: flex;
                padding: 0 2px;
                align-items: center;
                font-size: 12px;
                line-height: 16px;
                .magic-tree-iconEle  {
                    width: 18px;
                    height: 18px;
                    line-height: 1;
                    margin-right: 2px;
                    .anticon, svg {
                        width: 100%;
                        height: 100%;
                    }
                    .icon-variable {
                        color: #315CEC;
                    }
                    .icon-app {
                        svg {
                            stroke: #1C1D23;
                        }
                    }
					.is-variable-icon {
						svg {
							stroke: #FF7D00;
						}
					}
                }
                .magic-tree-title {
					display: flex;
					flex: 1;
                    &>span {
                        align-items: center;

                        .center {
                            margin-right: 4px;
                            color: #1C1D2359;
                            width: 30%;
                            overflow: hidden;
                            text-wrap: nowrap;
                            text-overflow: ellipsis;
                            text-align: right;
                        }
                        .right {
                            color: #1C1D2359;
                            overflow: hidden;
                            text-wrap: nowrap;
                            text-overflow: ellipsis;
                            text-align: right;
                        }
                        .left {
                            width: 70%;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    }

					&>span {
						display: flex;
						flex: 1;
					}
                }
            }
        }
    }
`