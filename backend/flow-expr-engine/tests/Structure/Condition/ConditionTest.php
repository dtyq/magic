<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Condition;

use Dtyq\FlowExprEngine\Builder\ConditionBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Condition\Condition;
use Dtyq\FlowExprEngine\Structure\Condition\ConditionItem;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ConditionTest extends BaseTestCase
{
    private ConditionBuilder $builder;

    public function setUp(): void
    {
        parent::setUp();
        $this->builder = new ConditionBuilder();
    }

    public function testBuild()
    {
        $conditionArray = $this->getInput();
        $condition = $this->builder->build($conditionArray);
        $this->assertInstanceOf(Condition::class, $condition);
        $this->assertEquals($conditionArray, $condition->toArray());
    }

    public function testGetAllFieldsExpressionItem()
    {
        $conditionArray = $this->getInput();
        $condition = $this->builder->build($conditionArray);
        $this->assertCount(1, $condition->getAllFieldsExpressionItem());
    }

    public function testCondition()
    {
        $conditionArray = $this->getInput();
        $condition = $this->builder->build($conditionArray);

        $this->assertEquals("((('哈哈哈') > (2)) && ((\$data['success']) || ((2) === ('2'))))", $condition->getCode());
        $this->assertTrue($condition->getResult(['success' => true]));
        $this->assertFalse($condition->getResult(['success' => false]));
    }

    public function testNumberCompatible()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
        "id": "component-66c444c8ca73e",
        "version": "1",
        "type": "condition",
        "structure": {
            "ops": "AND",
            "children": [
                {
                    "type": "compare",
                    "template": null,
                    "left_operands": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "fields",
                                "value": "518002981345849344.content",
                                "name": "",
                                "args": null,
                                "trans": "toNumber()"
                            }
                        ]
                    },
                    "condition": "equals",
                    "right_operands": {
                        "type": "const",
                        "const_value": [
                            {
                                "type": "input",
                                "value": "1",
                                "name": "",
                                "args": null
                            }
                        ],
                        "expression_value": null
                    }
                }
            ]
        }
    }
JSON,
            true
        );
        $condition = ComponentFactory::fastCreate($conditionArray)->getCondition();
        $this->assertEquals("(((\$data['518002981345849344.content_4d3f4496a89f21251abe33061e261c42']) == (1)))", $condition->getCode());
        $this->assertTrue($condition->getResult(['518002981345849344' => ['content' => 1]]));
    }

    public function testErrorInput()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
            {
                "type": "compare",
                "left_operands": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "uniqueId": "727422814327410688",
                            "value": "1"
                        }
                    ],
                    "expression_value": []
                },
                "condition": "not_empty",
                "right_operands": {
                    "type": "const",
                    "const_value": [],
                    "expression_value": []
                }
            }
        ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals('((true))', $condition->getCode());
        $this->assertTrue($condition->getResult());
    }

    public function testEmptyConditionWithConstant()
    {
        // Test with non-empty constant
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "left_operands": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "1"
                    }
                ],
                "expression_value": []
            },
            "condition": "empty",
            "right_operands": {
                "type": "const",
                "const_value": [],
                "expression_value": []
            }
        }
    ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals('((false))', $condition->getCode());
        $this->assertFalse($condition->getResult());

        // Test with empty constant
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "left_operands": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": ""
                    }
                ],
                "expression_value": []
            },
            "condition": "empty",
            "right_operands": {
                "type": "const",
                "const_value": [],
                "expression_value": []
            }
        }
    ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals('((true))', $condition->getCode());
        $this->assertTrue($condition->getResult());
    }

    public function testNumberCondition()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "left_operands": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "xxx",
                        "name": "1",
                        "args": null
                    }
                ]
            },
            "condition": "equals",
            "right_operands": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "123",
                        "name": "123",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        }
    ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals("(((\$data['xxx']) == (123)))", $condition->getCode());
        $this->assertTrue($condition->getResult(['xxx' => '123']));
    }

    public function testArrayEmptyCondition()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "left_operands": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "9527.xxx",
                        "name": "1",
                        "args": null
                    }
                ]
            },
            "condition": "empty",
            "right_operands": null
        }
    ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals("(((!isset((\$data['9527']['xxx'])))))", $condition->getCode());
        $this->assertTrue($condition->getResult(['9527' => ['xxx' => []]]));
    }

    public function testArrayValuableCondition()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "left_operands": {
                "type": "expression",
                "const_value": null,
                "expression_value": [
                    {
                        "type": "fields",
                        "value": "9527.xxx",
                        "name": "1",
                        "args": null
                    }
                ]
            },
            "condition": "valuable",
            "right_operands": null
        }
    ]
}
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertEquals("((((\$data['9527']['xxx']) ?? '') === ''))", $condition->getCode());
        $this->assertTrue($condition->getResult(['9527' => ['xxx' => []]]));
    }

    public function testConditionByTemplate()
    {
        $array = json_decode(
            <<<'JSON'
{
    "ops":"AND",
    "children":[
        {
            "type":"compare",
            "template":{
                "id":"widget-532820731101188096",
                "type":"widget",
                "version":"1",
                "structure":{
                    "key":"root",
                    "type":"object",
                    "sort":0,
                    "items":null,
                    "value":null,
                    "initial_value":null,
                    "display_config":null,
                    "properties":{
                        "left_operands":{
                            "type":"number",
                            "key":"left_operands",
                            "sort":0,
                            "items":null,
                            "properties":null,
                            "value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"555",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "initial_value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"默认值",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "display_config":{
                                "label":"",
                                "widget_type":"input",
                                "tooltips":"",
                                "required":true,
                                "visible":true,
                                "allow_expression":true,
                                "disabled":false,
                                "extra":null
                            }
                        },
                        "condition":{
                            "type":"string",
                            "key":"condition",
                            "sort":1,
                            "items":null,
                            "properties":null,
                            "value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"gt",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "initial_value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"默认值",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "display_config":{
                                "label":"",
                                "widget_type":"input",
                                "tooltips":"",
                                "required":true,
                                "visible":true,
                                "allow_expression":true,
                                "disabled":false,
                                "extra":null
                            }
                        },
                        "right_operands":{
                            "type":"number",
                            "key":"right_operands",
                            "sort":2,
                            "items":null,
                            "properties":null,
                            "value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"实际值",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "initial_value":{
                                "type":"const",
                                "const_value":[
                                    {
                                        "type":"input",
                                        "value":"默认值",
                                        "name":"name",
                                        "args":null
                                    }
                                ],
                                "expression_value":null
                            },
                            "display_config":{
                                "label":"",
                                "widget_type":"input",
                                "tooltips":"",
                                "required":true,
                                "visible":true,
                                "allow_expression":true,
                                "disabled":false,
                                "extra":null
                            }
                        }
                    }
                }
            },
            "left_operands":null,
            "condition":null,
            "right_operands":null
        }
    ]
}
JSON
            ,
            true
        );

        $condition = $this->builder->build($array);
        $this->assertEquals("(((555) > ('实际值')))", $condition->getCode());
        $this->assertFalse($condition->getResult());
    }

    public function testFirstRow()
    {
        $conditionArray = json_decode(
            <<<'JSON'
{
        "ops": "AND",
        "children": [
            {
                "ops": "AND",
                "children": [
                    {
                        "type": "compare",
                        "template": null,
                        "left_operands": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "component-65963366134af.guzzle.response.http_code",
                                    "name": "http状态码",
                                    "args": null
                                }
                            ]
                        },
                        "condition": "equals",
                        "right_operands": {
                            "type": "const",
                            "const_value": [
                                {
                                    "type": "input",
                                    "value": "200",
                                    "name": "200",
                                    "args": null
                                }
                            ],
                            "expression_value": null
                        }
                    },
                    {
                        "type": "compare",
                        "template": null,
                        "right_operands": {
                            "type": "const",
                            "const_value": [{
                                "type": "input",
                                "value": "",
                                "name": "",
                                "args": null
                            }],
                            "expression_value": null
                        },
                        "left_operands": {
                            "type": "expression",
                            "const_value": null,
                            "expression_value": [
                                {
                                    "type": "fields",
                                    "value": "component-65963366134af.guzzle.response.body",
                                    "name": "响应体",
                                    "args": null
                                },
                                {
                                    "type": "input",
                                    "value": "['code']",
                                    "name": "",
                                    "args": null
                                }
                            ]
                        },
                        "condition": "not_empty"
                    }
                ]
            },
            {
                "type": "compare",
                "right_operands": {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "1000",
                            "name": "1000",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                "left_operands": {
                    "type": "expression",
                    "const_value": null,
                    "expression_value": [
                        {
                            "type": "fields",
                            "value": "component-65963366134af.guzzle.response.body",
                            "name": "响应体",
                            "args": null
                        },
                        {
                            "type": "input",
                            "value": "['code']",
                            "name": "",
                            "args": null
                        }
                    ]
                },
                "template": null,
                "condition": "equals"
            }
        ]
    }
JSON,
            true
        );
        $condition = $this->builder->build($conditionArray);
        $this->assertInstanceOf(ConditionItem::class, $condition->getFirstRow());
        $this->assertEquals($conditionArray, $condition->toArray());
    }

    private function getInput()
    {
        return json_decode(<<<'JSON'
{
    "ops": "AND",
    "children": [
        {
            "type": "compare",
            "template": null,
            "left_operands": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "哈哈哈",
                        "name": "1",
                        "args": null
                    }
                ],
                "expression_value": null
            },
            "condition": "gt",
            "right_operands": {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "2",
                        "name": "2",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        },
        {
            "ops": "OR",
            "children": [
                {
                    "type": "operation",
                    "template": null,
                    "operands": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "fields",
                                "value": "success",
                                "name": "true",
                                "args": null
                            }
                        ]
                    }
                },
                {
                    "type": "compare",
                    "template": null,
                    "left_operands": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "input",
                                "value": "2",
                                "name": "2",
                                "args": null
                            }
                        ]
                    },
                    "condition": "equals",
                    "right_operands": {
                        "type": "expression",
                        "const_value": null,
                        "expression_value": [
                            {
                                "type": "input",
                                "value": "'2'",
                                "name": "2",
                                "args": null
                            }
                        ]
                    }
                }
            ]
        }
    ]
}
JSON, true);
    }
}
