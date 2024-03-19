<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Widget;

use Dtyq\FlowExprEngine\Builder\WidgetBuilder;
use Dtyq\FlowExprEngine\Structure\Widget\ShowOptions;
use Dtyq\FlowExprEngine\Structure\Widget\Widget;
use Dtyq\FlowExprEngine\Test\BaseTestCase;
use Throwable;

/**
 * @internal
 * @coversNothing
 */
class WidgetTest extends BaseTestCase
{
    private WidgetBuilder $builder;

    public function setUp(): void
    {
        parent::setUp();
        $this->builder = new WidgetBuilder();
    }

    public function testBuild()
    {
        $array = $this->getTestInputs();
        $widget = $this->builder->build($array);
        $this->assertInstanceOf(Widget::class, $widget);
    }

    public function testGetWidgetsArray()
    {
        $array = $this->getTestInputs();
        $widget = $this->builder->build($array);
        $this->assertEquals($array, $widget->toArray());
    }

    public function testDesensitization()
    {
        $array = $this->getTestInputs();
        $widget = $this->builder->build($array);
        $toArray = $widget->toArray();
        $this->assertEquals($array, $toArray);

        $builder = new WidgetBuilder(new ShowOptions(true));
        $widget = $builder->build($toArray);
        $this->assertEquals([
            'type' => 'const',
            'const_value' => [
                [
                    'type' => 'input',
                    'value' => '******',
                    'name' => 'append_const_value',
                    'args' => null,
                ],
            ],
            'expression_value' => null,
        ], $widget->toArray()['properties']['field_0']['value']);
    }

    public function testGetKeyValue()
    {
        $targetWidgets = $this->getTestInputs();
        $widgets = $this->builder->build($targetWidgets);
        $widgets->setComponentId('123');
        $this->assertEquals([
            'field_0' => '实际值',
            'field_1' => '123',
            'field_2' => false,
            'field_3' => '1',
            'member' => [
                '123',
            ],
            'time-picker' => '20230801 00:00:00',
            'checkbox' => false,
            'files' => [
                [
                    'key' => 'xxx',
                    'name' => 'xxx',
                ],
                [
                    'key' => 'eee',
                    'name' => 'eee',
                ],
            ],
        ], $widgets->getKeyValue([
            'members' => [
                'member1' => ['123'],
            ],
            'files' => [
                [
                    'key' => 'xxx',
                    'name' => 'xxx',
                ],
                [
                    'key' => 'eee',
                    'name' => 'eee',
                ],
            ],
        ]));
    }

    public function testValidate()
    {
        $array = $this->getTestValidateInputs();
        $widget = $this->builder->build($array);
        $widget->validate();
        $this->assertTrue(true);

        $this->builder->build(json_decode(
            <<<'JSON'
{
    "type":"object",
    "key":"root",
    "sort":0,
    "initial_value":null,
    "value":null,
    "display_config":null,
    "items":null,
    "properties":{
        "object":{
            "type":"object",
            "key":"object",
            "sort":2,
            "initial_value":null,
            "value":null,
            "display_config":{
                "label":"动态的字段",
                "widget_type":"object",
                "tooltips":"",
                "required":true,
                "visible":true,
                "allow_expression":true,
                "disabled":false,
                "extra":{
                    "dynamic_fields":true,
                    "data_source":null,
                    "data_source_api":null
                },
                "web_config":{
                    "dependencies":[
                        "component-65937c6b17381.title",
                        "component-65937c6b17381.options"
                    ]
                }
            },
            "items":null,
            "properties":{
                "people":{
                    "type":"array",
                    "key":"people",
                    "sort":1,
                    "initial_value":null,
                    "value":null,
                    "display_config":{
                        "label":"人员",
                        "widget_type":"object",
                        "tooltips":"",
                        "required":true,
                        "visible":true,
                        "allow_expression":true,
                        "disabled":false,
                        "extra":{
                            "dynamic_fields":false,
                            "data_source":[

                            ],
                            "data_source_api":null
                        },
                        "web_config":{
                            "dependencies":[

                            ]
                        }
                    },
                    "items":{
                        "type":"object",
                        "key":"people",
                        "sort":0,
                        "initial_value":null,
                        "value":null,
                        "display_config":{
                            "label":"",
                            "widget_type":"object",
                            "tooltips":"",
                            "required":false,
                            "visible":true,
                            "allow_expression":true,
                            "disabled":false,
                            "extra":{
                                "dynamic_fields":false,
                                "data_source":[

                                ],
                                "data_source_api":null
                            },
                            "web_config":{
                                "dependencies":[

                                ]
                            }
                        },
                        "items":null,
                        "properties":{
                            "id":{
                                "type":"string",
                                "key":"id",
                                "sort":0,
                                "initial_value":null,
                                "value":null,
                                "display_config":{
                                    "label":"",
                                    "widget_type":"input",
                                    "tooltips":"",
                                    "required":false,
                                    "visible":true,
                                    "allow_expression":true,
                                    "disabled":false,
                                    "extra":null,
                                    "web_config":null
                                },
                                "items":null,
                                "properties":null
                            }
                        }
                    },
                    "properties":[
                        {
                            "type":"object",
                            "key":"0",
                            "sort":0,
                            "initial_value":null,
                            "value":null,
                            "display_config":{
                                "label":"",
                                "widget_type":"object",
                                "tooltips":"",
                                "required":false,
                                "visible":true,
                                "allow_expression":true,
                                "disabled":false,
                                "extra":{
                                    "dynamic_fields":false,
                                    "data_source":[

                                    ],
                                    "data_source_api":null
                                },
                                "web_config":{
                                    "dependencies":[

                                    ]
                                }
                            },
                            "items":null,
                            "properties":{
                                "id":{
                                    "type":"string",
                                    "key":"id",
                                    "sort":0,
                                    "initial_value":null,
                                    "value":{
                                        "type":"const",
                                        "const_value":[
                                            {
                                                "type":"input",
                                                "value":"ff",
                                                "name":"",
                                                "args":null
                                            }
                                        ],
                                        "expression_value":null
                                    },
                                    "display_config":{
                                        "label":"",
                                        "widget_type":"input",
                                        "tooltips":"",
                                        "required":false,
                                        "visible":true,
                                        "allow_expression":true,
                                        "disabled":false,
                                        "extra":null,
                                        "web_config":null
                                    },
                                    "items":null,
                                    "properties":null
                                }
                            }
                        }
                    ]
                }
            }
        }
    }
}
JSON,
            true
        ))->validate();
        $this->assertTrue(true);

        try {
            $this->builder->build(json_decode(
                <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "properties": {
        "field_0": {
            "type": "string",
            "key": "field_0",
            "sort": 0,
            "items": null,
            "properties": null,
            "value": null,
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "默认值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "字段0",
                "widget_type": "input-password",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        }
    }
}
JSON,
                true
            ))->validate();
        } catch (Throwable $throwable) {
            if ($throwable->getMessage() === '字段0[field_0] 不能为空') {
                $this->assertTrue(true);
            } else {
                throw $throwable;
            }
        }

        try {
            $this->builder->build(json_decode(
                <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "properties": {
        "field_0": {
            "type": "string",
            "key": "field_0",
            "sort": 0,
            "items": null,
            "properties": null,
            "value": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "xxx",
                        "name": "name",
                        "args": null
                    }
                ]
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "默认值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "字段0",
                "widget_type": "input-password",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": false,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        }
    }
}
JSON,
                true
            ))->validate();
        } catch (Throwable $throwable) {
            if ($throwable->getMessage() === '字段0[field_0] 不允许使用表达式') {
                $this->assertTrue(true);
            } else {
                throw $throwable;
            }
        }

        try {
            $this->builder->build(json_decode(
                <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "properties": {
        "field_0": {
            "type": "object",
            "key": "field_0",
            "sort": 0,
            "items": null,
            "properties": {
                "field_1": {
                    "type": "string",
                    "key": "field_1",
                    "sort": 0,
                    "items": null,
                    "properties": null,
                    "value": null,
                    "initial_value": {
                        "type": "const",
                        "const_value": [
                            {
                                "type": "input",
                                "value": "默认值",
                                "name": "name",
                                "args": null
                            }
                        ],
                        "expression_value": null
                    },
                    "display_config": {
                        "label": "字段field_0.field_1",
                        "widget_type": "input-password",
                        "tooltips": "",
                        "required": true,
                        "visible": true,
                        "allow_expression": true,
                        "disabled": false,
                        "extra": null,
                        "web_config": null
                    }
                }
            },
            "value": null,
            "initial_value": null,
            "display_config": null
        }
    }
}
JSON,
                true
            ))->validate();
        } catch (Throwable $throwable) {
            if ($throwable->getMessage() === '字段field_0.field_1[field_1] 不能为空') {
                $this->assertTrue(true);
            } else {
                throw $throwable;
            }
        }

        try {
            $this->builder->build(json_decode(
                <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "properties": {
        "field_0": {
            "type": "array",
            "key": "field_0",
            "sort": 0,
            "items": {
                "type": "string",
                "key": "field_0",
                "sort": 0,
                "items": null,
                "properties": null
            },
            "properties": null,
            "value": null,
            "initial_value": null,
            "display_config": {
                "label": "字段field_0",
                "widget_type": "input-password",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        }
    }
}
JSON,
                true
            ))->validate();
        } catch (Throwable $throwable) {
            if ($throwable->getMessage() === '字段field_0[field_0] 不能为空') {
                $this->assertTrue(true);
            } else {
                throw $throwable;
            }
        }
    }

    private function getTestInputs(): array
    {
        $inputs = <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "title": "",
    "description": "",
    "properties": {
        "field_0": {
            "type": "string",
            "key": "field_0",
            "title": "field_0",
            "description": "desc",
            "sort": 0,
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "实际值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "默认值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "input-password",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        },
        "field_1": {
            "type": "number",
            "key": "field_1",
            "sort": 1,
            "title": "",
            "description": "",
            "items": null,
            "properties": null,
            "value": null,
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "123",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "input-number",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "max": 100000,
                    "min": -100000,
                    "step": 1
                },
                "web_config": null
            }
        },
        "field_2": {
            "type": "boolean",
            "key": "field_2",
            "sort": 2,
            "title": "",
            "description": "",
            "items": null,
            "properties": null,
            "value": null,
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "false",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "switch",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "checked_text": "开启",
                    "unchecked_text": "关闭"
                },
                "web_config": null
            }
        },
        "field_3": {
            "type": "string",
            "key": "field_3",
            "sort": 3,
            "title": "",
            "description": "",
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "1",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": null,
            "display_config": {
                "label": "",
                "widget_type": "select",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "dynamic_fields": false,
                    "data_source": [
                        {
                            "label": "选项1",
                            "value": "1"
                        },
                        {
                            "label": "选项2",
                            "value": "2"
                        }
                    ],
                    "data_source_api": null
                },
                "web_config": null
            }
        },
        "member": {
            "type": "array",
            "key": "member",
            "sort": 4,
            "title": "",
            "description": "",
            "items": {
                "type": "string",
                "title": "member",
                "description": "desc",
                "key": "",
                "sort": 0,
                "items": null,
                "properties": null,
                "value": null,
                "initial_value": null,
                "display_config": null
            },
            "properties": null,
            "value": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "members.member1",
                        "name": "name",
                        "args": null
                    }
                ]
            },
            "initial_value": null,
            "display_config": {
                "label": "",
                "widget_type": "member",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        },
        "time-picker": {
            "type": "string",
            "key": "time-picker",
            "sort": 5,
            "title": "",
            "description": "",
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "20230801 00:00:00",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "默认值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "time-picker",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        },
        "checkbox": {
            "type": "boolean",
            "key": "checkbox",
            "sort": 6,
            "title": "",
            "description": "",
            "items": null,
            "properties": null,
            "value": null,
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "false",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "checkbox",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        },
        "files": {
            "type": "array",
            "key": "files",
            "sort": 7,
            "title": "",
            "description": "",
            "items": {
                "type": "object",
                "title": "附件",
                "description": "desc",
                "key": "",
                "sort": 0,
                "items": null,
                "properties": {
                    "key": {
                        "type": "string",
                        "key": "key",
                        "sort": 0,
                        "title": "附件 key",
                        "description": "desc",
                        "items": null,
                        "properties": null,

                        "value": null,
                        "initial_value": null,
                        "display_config": null
                    },
                    "name": {
                        "type": "string",
                        "key": "name",
                        "sort": 1,
                        "title": "附件名称",
                        "description": "desc",
                        "items": null,
                        "properties": null,
                        "value": null,
                        "initial_value": null,
                        "display_config": null
                    }
                },

                "value": null,
                "initial_value": null,
                "display_config": null
            },
            "properties": null,
            "value": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "files",
                        "name": "name",
                        "args": null
                    }
                ]
            },
            "initial_value": null,
            "display_config": {
                "label": "",
                "widget_type": "member",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        }
    }
}
JSON;
        return json_decode($inputs, true);
    }

    private function getTestValidateInputs(): array
    {
        $inputs = <<<'JSON'
{
    "key": "root",
    "type": "object",
    "sort": 0,
    "items": null,
    "value": null,
    "initial_value": null,
    "display_config": null,
    "properties": {
        "field_0": {
            "type": "string",
            "key": "field_0",
            "sort": 0,
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "实际值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "默认值",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "input-password",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": null,
                "web_config": null
            }
        },
        "field_1": {
            "type": "number",
            "key": "field_1",
            "sort": 1,
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "123",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "123",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "input-number",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "max": 100000,
                    "min": -100000,
                    "step": 1
                },
                "web_config": null
            }
        },
        "field_2": {
            "type": "boolean",
            "key": "field_2",
            "sort": 2,
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "true",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "false",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "display_config": {
                "label": "",
                "widget_type": "switch",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "checked_text": "开启",
                    "unchecked_text": "关闭"
                },
                "web_config": null
            }
        },
        "field_3": {
            "type": "string",
            "key": "field_3",
            "sort": 3,
            "items": null,
            "properties": null,
            "value": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "1",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "initial_value": null,
            "display_config": {
                "label": "",
                "widget_type": "select",
                "tooltips": "",
                "required": true,
                "visible": true,
                "allow_expression": true,
                "disabled": false,
                "extra": {
                    "dynamic_fields": false,
                    "data_source": [
                        {
                            "label": "选项1",
                            "value": "1"
                        },
                        {
                            "label": "选项2",
                            "value": "2"
                        }
                    ],
                    "data_source_api": null
                },
                "web_config": null
            }
        }
    }
}
JSON;
        return json_decode($inputs, true);
    }
}
