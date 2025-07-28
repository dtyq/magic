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
class ValueMethodDateTest extends BaseTestCase
{
    private ValueBuilder $builder;

    public function setUp(): void
    {
        parent::setUp();
        $this->builder = new ValueBuilder();
    }

    public function testGetISO8601Date()
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
                            "value": "1634799280",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string
        $this->assertIsString($result);

        // Verify format: YYYY-MM-DD
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result);

        // Verify specific date for timestamp 1634799280 (2021-10-21)
        $this->assertStringContainsString('2021-10-21', $result);
    }

    public function testGetISO8601DateWithCurrentTime()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_iso8601_date",
            "name": "get_iso8601_date",
            "args": []
        }
    ],
    "expression_value": null
}
JSON, true);

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string with correct format
        $this->assertIsString($result);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result);
    }

    public function testGetISO8601DateTime()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_iso8601_date_time",
            "name": "get_iso8601_date_time",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "1634799280",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string
        $this->assertIsString($result);

        // Verify format: YYYY-MM-DDTHH:MM:SSZ (ISO 8601 UTC format)
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $result);

        // Verify specific datetime for timestamp 1634799280 (UTC time)
        $this->assertStringContainsString('2021-10-21T06:54:40Z', $result);
    }

    public function testGetISO8601DateTimeWithOffset()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_iso8601_date_time_with_offset",
            "name": "get_iso8601_date_time_with_offset",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "1634799280",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string
        $this->assertIsString($result);

        // Verify format: YYYY-MM-DDTHH:MM:SS±HH:MM (ISO 8601 with timezone offset)
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{2}:\d{2}$/', $result);

        // Verify contains the date part
        $this->assertStringContainsString('2021-10-21T', $result);
    }

    public function testGetRFC1123DateTime()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_rfc1123_date_time",
            "name": "get_rfc1123_date_time",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "1634799280",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string
        $this->assertIsString($result);

        // Verify format: Day, DD Mon YYYY HH:MM:SS GMT
        $this->assertMatchesRegularExpression('/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/', $result);

        // Verify specific datetime for timestamp 1634799280 (UTC time)
        $this->assertStringContainsString('21 Oct 2021 06:54:40 GMT', $result);
    }

    public function testGetISO8601DateWithStringInput()
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
                            "value": "2021-10-21 14:28:00",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string with correct format
        $this->assertIsString($result);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $result);
        $this->assertStringContainsString('2021-10-21', $result);
    }

    public function testGetISO8601DateTimeWithStringInput()
    {
        $array = json_decode(<<<'JSON'
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "get_iso8601_date_time",
            "name": "get_iso8601_date_time",
            "args": [
                {
                    "type": "const",
                    "const_value": [
                        {
                            "type": "input",
                            "value": "2021-10-21 14:28:00",
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

        $value = $this->builder->build($array);
        $result = $value->getResult();

        // Verify result is a string with correct format
        $this->assertIsString($result);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $result);
    }

    public function testAllDateMethodsWithNullInput()
    {
        $methods = [
            'get_iso8601_date',
            'get_iso8601_date_time',
            'get_iso8601_date_time_with_offset',
            'get_rfc1123_date_time',
        ];

        foreach ($methods as $method) {
            $array = json_decode(<<<JSON
{
    "type": "const",
    "const_value": [
        {
            "type": "methods",
            "value": "{$method}",
            "name": "{$method}",
            "args": []
        }
    ],
    "expression_value": null
}
JSON, true);

            $value = $this->builder->build($array);
            $result = $value->getResult();

            // All methods should return string when called with null/no arguments
            $this->assertIsString($result, "Method {$method} should return string");
            $this->assertNotEmpty($result, "Method {$method} should not return empty string");
        }
    }
}
