<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Value;

use Dtyq\FlowExprEngine\Builder\ValueBuilder;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ValueDisplayTest extends BaseTestCase
{
    public function testMember()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "member",
            "value": "message",
            "name": "message",
            "args": null,
            "member_value": [
                {
                    "id": "430379931150888960",
                    "name": "蔡伦多",
                    "avatar": "",
                    "position": "管培生",
                    "user_groups": [],
                    "email": "team@dtyq.cn",
                    "job_number": "",
                    "departments": [
                        {
                            "id": "552075023930417156",
                            "name": "技术中心",
                            "path_name": "技术中心"
                        }
                    ]
                }
            ]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals('蔡伦多', $value->getResult()[0]['name']);
    }

    public function testMemberWithFields()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "member",
            "value": "",
            "name": "message",
            "args": null,
            "member_value": [
                {
                    "id": "430379931150888960",
                    "name": "蔡伦多",
                    "type": "user",
                    "avatar": ""
                },
                {
                    "type": "fields",
                    "value": "9527.user",
                    "name": "name",
                    "args": []
                },
                {
                    "id": "430379931150888961",
                    "name": "蔡伦多",
                    "type": "department",
                    "avatar": ""
                }
            ]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals([
            [
                'id' => '430379931150888960',
                'name' => '蔡伦多',
                'type' => 'user',
                'avatar' => '',
            ],
            [
                'id' => '111222',
                'name' => '蔡伦多',
                'type' => 'user',
                'avatar' => 'xx',
            ],
            [
                'id' => '430379931150888961',
                'name' => '蔡伦多',
                'type' => 'department',
                'avatar' => '',
            ],
        ], $value->getResult([
            '9527' => [
                'user' => [
                    'id' => '111222',
                    'name' => '蔡伦多',
                    'type' => 'user',
                    'avatar' => 'xx',
                ],
            ],
        ]));
    }

    public function testDatetime()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "datetime",
            "value": "message",
            "name": "message",
            "args": null,
            "datetime_value": {
                "type": "today",
                "value": ""
            }
        },
        {
            "type": "fields",
            "value": "message",
            "name": "message",
            "args": null
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals(date('Y-m-d 00:00:00') . ' xxx', $value->getResult(['message' => ' xxx']));

        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "datetime",
            "value": "message",
            "name": "message",
            "args": null,
            "datetime_value": {
                "type": "trigger_time",
                "value": ""
            }
        },
        {
            "type": "fields",
            "value": "message",
            "name": "message",
            "args": null
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals(date('Y-m-d H:i:s') . ' xxx', $value->getResult(['message' => ' xxx']));
    }

    public function testMultiple()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "multiple",
            "value": "message",
            "name": "message",
            "args": null,
            "multiple_value": ["Fr4IOy1728959555812"]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals(['Fr4IOy1728959555812'], $value->getResult());
    }

    public function testSelect()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "select",
            "value": "message",
            "name": "message",
            "args": null,
            "select_value": ["Fr4IOy1728959555812"]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals(['Fr4IOy1728959555812'], $value->getResult());
    }

    public function testCheckbox()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "checkbox",
            "value": "message",
            "name": "message",
            "args": null,
            "checkbox_value": true
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertTrue($value->getResult());
    }

    public function testDepartmentNames()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "department_names",
            "value": "message",
            "name": "message",
            "args": null,
            "department_names_value": [
                "技术中心", "商品中心"
            ]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals(['技术中心', '商品中心'], $value->getResult());
    }

    public function testNames()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "names",
            "value": "message",
            "name": "message",
            "args": null,
            "names_value": [
                {
                    "id": "552075023930417156",
                    "name": "技术中心"
                },
                {
                   "id": "552075023930417157",
                   "name": "技术中心1"
                },
                {
                   "type": "fields",
                   "value": "9527.name"
                }
            ]
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
        $this->assertEquals([
            ['id' => '552075023930417156', 'name' => '技术中心'],
            ['id' => '552075023930417157', 'name' => '技术中心1'],
            ['id' => '552075023930417158', 'name' => '技术中心2'],
        ], $value->getResult([
            '9527' => [
                'name' => [
                    'id' => '552075023930417158', 'name' => '技术中心2',
                ],
            ],
        ]));
    }
}
