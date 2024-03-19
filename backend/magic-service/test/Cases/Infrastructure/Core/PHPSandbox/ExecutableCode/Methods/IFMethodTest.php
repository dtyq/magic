<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Core\PHPSandbox\ExecutableCode\Methods;

use Connector\Component\Builder\ValueBuilder;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class IFMethodTest extends BaseTest
{
    public function testRun()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "logical_if",
            "name": "if",
            "args": [
              {
                "type": "const",
                "const_value": [
                  {
                    "type": "fields",
                    "value": "9527.logical",
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
                    "value": "trueValue",
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
                    "value": "falseValue",
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
        $this->assertEquals('trueValue', $value->getResult(['9527' => ['logical' => true]]));
        $this->assertEquals('falseValue', $value->getResult(['9527' => ['logical' => false]]));
    }
}
