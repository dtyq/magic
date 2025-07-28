<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Expression;

use Dtyq\FlowExprEngine\Builder\ExpressionBuilder;
use Dtyq\FlowExprEngine\Structure\Expression\Expression;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class ExpressionTest extends BaseTestCase
{
    public function testBuild()
    {
        $builder = new ExpressionBuilder();
        $input = $this->getInput();
        $expression = $builder->build($input);

        $this->assertInstanceOf(Expression::class, $expression);
        $this->assertEquals($input, $expression->toArray());
    }

    public function testStringTemplateRunner()
    {
        $input = [
            [
                'type' => 'input',
                'value' => '你是一个有用的助手，能解决',
                'name' => '',
            ],
            [
                'type' => 'fields',
                'value' => '9527.language',
                'name' => '',
            ],
            [
                'type' => 'input',
                'value' => '的问题，并且能够同时帮助',
                'name' => '',
            ],
            [
                'type' => 'fields',
                'value' => '9527.num',
                'name' => '',
            ],
            [
                'type' => 'input',
                'value' => '个人。"嘻嘻"',
                'name' => '',
            ],
        ];

        $builder = new ExpressionBuilder();
        $expression = $builder->build($input);
        $expression->setIsStringTemplate(true);
        $res = $expression->getResult([
            '9527' => [
                'language' => 'PHP',
                'num' => 9527,
            ],
        ]);
        $this->assertEquals('你是一个有用的助手，能解决PHP的问题，并且能够同时帮助9527个人。"嘻嘻"', $res);
    }

    public function testNumberConst()
    {
        $input = json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "md5",
        "name": "md5",
        "args": [
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "'123'",
                        "name": "name",
                        "args": null
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON
            ,
            true
        );
        $builder = new ExpressionBuilder();
        $expression = $builder->build($input);
        $this->assertInstanceOf(Expression::class, $expression);
        $this->assertEquals($input, $expression->toArray());
    }

    public function testGetExpressionString()
    {
        $builder = new ExpressionBuilder();
        $input = $this->getInput();
        $expression = $builder->build($input);
        $this->assertEquals('$data[\'product_qty\'][0]*23+round((23.666555),(2))', $expression->getCode());
    }

    public function testRunner()
    {
        $builder = new ExpressionBuilder();
        $input = $this->getInput();
        $expression = $builder->build($input);

        $this->assertEquals(46.67, $expression->getResult(['product_qty' => [1]]));
        $this->assertEquals(69.67, $expression->getResult(['product_qty' => [2]]));
    }

    public function testMethods()
    {
        $builder = new ExpressionBuilder();

        $expression = $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "md5",
        "name": "md5",
        "args": [
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "嘻嘻",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON,
            true
        ));
        $this->assertEquals('aa068250325852a3478835e3acbd6ccd', $expression->getResult([]));

        $expression = $builder->build(json_decode(
            <<<'JSON'
[
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
                        "value": "a.b",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON,
            true
        ));
        $this->assertEquals('aa068250325852a3478835e3acbd6ccd', $expression->getResult(['a' => ['b' => '嘻嘻']]));

        $expression = $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "mt_rand",
        "name": "mt_rand",
        "args": [
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "1",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            },
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "10",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON,
            true
        ));
        $this->assertIsInt($expression->getResult([]));

        $this->assertEquals(26.45, $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "round",
        "name": "round",
        "args": [
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "26.446555",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            },
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "2",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON,
            true
        ))->getResult());

        $this->assertTrue($builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "str_contains",
        "name": "str_contains",
        "args": [
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "hello world",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            },
            {
                "type": "const",
                "const_value": [
                    {
                        "type": "input",
                        "value": "hello",
                        "name": "name",
                        "args": []
                    }
                ],
                "expression_value": null
            }
        ]
    }
]
JSON,
            true
        ))->getResult());

        $this->assertIsInt($builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "time",
        "name": "time",
        "args": []
    }
]
JSON,
            true
        ))->getResult());

        $this->assertIsString($builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "uniqid",
        "name": "uniqid",
        "args": []
    }
]
JSON,
            true
        ))->getResult());
    }

    public function testGetDate()
    {
        $builder = new ExpressionBuilder();
        $this->assertEquals(date('Y-m-d'), $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "get_iso8601_date",
        "name": "get_iso8601_date",
        "args": []
    }
]
JSON,
            true
        ))->getResult());

        // Test that get_iso8601_date_time returns UTC time with Z suffix
        $result = $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "get_iso8601_date_time",
        "name": "get_iso8601_date_time",
        "args": []
    }
]
JSON,
            true
        ))->getResult();
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $result);

        $this->assertEquals(date('Y-m-d\TH:i:s') . date('P'), $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "get_iso8601_date_time_with_offset",
        "name": "get_iso8601_date_time_with_offset",
        "args": []
    }
]
JSON,
            true
        ))->getResult());

        $this->assertEquals(date('D, d M Y H:i:s \G\M\T'), $builder->build(json_decode(
            <<<'JSON'
[
    {
        "type": "methods",
        "value": "get_rfc1123_date_time",
        "name": "get_rfc1123_date_time",
        "args": []
    }
]
JSON,
            true
        ))->getResult());
    }

    private function getInput()
    {
        return json_decode(
            <<<'JSON'
[
    {
        "type":"fields",
        "value":"product_qty[0]",
        "name":"商品数量",
        "args":null
    },
    {
        "type":"input",
        "value":"*23+",
        "name":"*23+",
        "args":null
    },
    {
        "type":"methods",
        "value":"round",
        "name":"四舍五入",
        "args":[
            {
                "type":"const",
                "const_value":[
                    {
                        "type":"input",
                        "value":"23.666555",
                        "name":"name",
                        "args":null
                    }
                ],
                "expression_value":null
            },
            {
                "type":"const",
                "const_value":[
                    {
                        "type":"input",
                        "value":"2",
                        "name":"name",
                        "args":null
                    }
                ],
                "expression_value":null
            }
        ]
    }
]
JSON,
            true
        );
    }
}
