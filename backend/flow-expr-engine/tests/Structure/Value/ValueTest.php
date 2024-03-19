<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Value;

use Dtyq\FlowExprEngine\Builder\ValueBuilder;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\Expression\Value;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ValueTest extends BaseTestCase
{
    public function testBuild()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "name": "message"
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertInstanceOf(Value::class, $value);
    }

    public function testBuild1()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "args": null,
            "name": "",
            "type": "input",
            "value": ""
        }
    ],
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "name": "message"
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertInstanceOf(Value::class, $value);
        $this->assertNotNull($value?->getConstValue());

        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": [
        {
            "args": null,
            "name": "",
            "type": "input",
            "value": ""
        }
    ],
    "expression_value": [
        {
            "type": "input",
            "value": "",
            "name": "message"
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertInstanceOf(Value::class, $value);
        $this->assertNotNull($value?->getExpressionValue());
    }

    public function testIn()
    {
        $array = json_decode(<<<'JSON'
{
    "id": "component-663c6d3ed0aa4",
    "version": "1",
    "type": "value",
    "structure": {
        "type": "expression",
        "expression_value": [
            {
                "type": "input",
                "uniqueId": "649549412367863809",
                "value": "123"
            }
        ]
    }
}
JSON, true);
        $value = ComponentFactory::fastCreate($array)->getValue();

        $this->assertInstanceOf(Value::class, $value);
    }

    public function testToArray()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "name": "message",
            "args": null
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals($array, $value->toArray());
    }

    public function testGetAllFieldsExpressionItem()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "name": "message",
            "args": null
        },
        {
            "type": "input",
            "value": ".",
            "name": "message",
            "args": null
        },
        {
            "type": "methods",
            "value": "md5",
            "name": "md5",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "md5",
                            "name": "name",
                            "trans": "toString()",
                            "args": []
                        }
                    ],
                    "expression_value": null
                }
            ]
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertCount(2, $value->getAllFieldsExpressionItem());
        $this->assertEquals('123' . md5('888'), $value->getResult(['message' => '123', 'md5' => 888]));
    }

    public function testConstWithMethod()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "input",
            "value": "123",
            "name": "message",
            "args": null
        },
        {
            "type": "input",
            "value": "message'\"",
            "name": "message",
            "args": null
        },
        {
            "type": "methods",
            "value": "md5",
            "name": "md5",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "fields",
                            "value": "md50",
                            "name": "name",
                            "args": []
                        }
                    ],
                    "expression_value": null
                }
            ]
        },
        {
            "type": "input",
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
        $this->assertEquals('123message\'"' . md5('123') . 'message', $value->getResult(['md50' => '123']));
    }

    public function testConstWithMethod1()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "uniqueId": "665741712181694464",
            "value": "get_rfc1123_date_time",
            "args": [
                 {
                     "type": "const",
                     "const_value": [],
                     "expression_value": []
                 }
            ],
            "name": "get_rfc1123_date_time"
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertIsString($value->getResult(['md50' => '123']));
    }

    public function testConstWithMethod2()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": [],
    "expression_value": [
        {
            "type": "methods",
            "uniqueId": "666195206181228544",
            "value": "get_rfc1123_date_time",
            "args": [
                {
                    "type": "expression",
                    "const_value": [],
                    "expression_value": [
                        {
                            "type": "input",
                            "uniqueId": "666195230579494912",
                            "value": ""
                        },
                        {
                            "type": "fields",
                            "uniqueId": "666195245343444992",
                            "value": "532090106643902464.chat_time"
                        }
                    ]
                }
            ],
            "name": "get_rfc1123_date_time"
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertIsString($value->getResult(['532090106643902464' => ['chat_time' => '2023-09-09 09:00:01']]));
    }

    public function testGetResult()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "fields",
            "value": "node_key",
            "name": "message",
            "trans": "toString()",
            "args": null
        },
        {
            "type": "input",
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
        $this->assertEquals('123message', $value->getResult(['node_key' => '123']));

        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "node_key",
            "name": "message",
            "trans": "toNumber()",
            "args": null
        },
        {
            "type": "input",
            "value": "+1",
            "name": "message",
            "args": null
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);

        $this->assertEquals('124', $value->getResult(['node_key' => '123']));
    }

    public function testTransToJoin()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message.nums",
            "name": "message",
            "trans": "join(',').toArray().toJson()",
            "args": null
        },
        {
            "type": "input",
            "value": ".'xxx'",
            "name": "xxx",
            "args": null
        }
    ]
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals('["1,2,3"]xxx', $value->getResult([
            'message' => [
                'nums' => [1, 2, 3],
            ],
        ]));
    }

    public function testMethodWithoutArg()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_iso8601_date",
            "name": "get_iso8601_date",
            "args": [
              {
                "type": "const",
                "const_value": [
                  {
                    "type": "input",
                    "value": "",
                    "name": "",
                    "args": null
                  }
                ],
                "expression_value": null
              }
            ]
        },
        {
            "type": "input",
            "value": "xxx"
        }
    ],
    "expression_value": null
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals(date('Y-m-d') . 'xxx', $value->getResult());
    }

    public function testTransToNumber()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toNumber()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals('1', $value->getResult(['message' => true]));
    }

    public function testTransToJson()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toJson()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals('{"a":1}', $value->getResult(['message' => ['a' => 1]]));
    }

    public function testTransToString()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toString()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals('{"a":1}', $value->getResult(['message' => ['a' => 1]]));
    }

    public function testTransToArray()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toArray()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals([['a' => 1]], $value->getResult(['message' => ['a' => 1]]));

        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toArray().count()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals(1, $value->getResult(['message' => ['a' => 1]]));

        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toArray().empty()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertFalse($value->getResult(['message' => ['a' => 1]]));
    }

    public function testTransToBoolean()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "expression",
    "const_value": null,
    "expression_value": [
        {
            "type": "fields",
            "value": "message",
            "trans": "toBoolean()",
            "name": "message"
        }
    ]
}
JSON, true);

        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertTrue($value->getResult(['message' => 1]));
    }
}
