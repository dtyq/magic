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
class ValueMethodTest extends BaseTestCase
{
    public function testStrReplace()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "str_replace",
            "name": "str_replace",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "世界",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "world",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "hello 世界",
                            "name": "",
                            "args": null
                        }
                    ],
                    "expression_value": null
                },
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
        }
    ],
    "expression_value": null
}
JSON, true);
        $builder = new ValueBuilder();
        $value = $builder->build($array);
        $this->assertEquals(str_replace('世界', 'world', 'hello 世界'), $value->getResult());
    }
}
