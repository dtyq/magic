<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Test\Structure\Api;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Structure\Api\Safe\DefenseAgainstSSRF;
use Dtyq\FlowExprEngine\Structure\Api\Safe\DefenseAgainstSSRFOptions;
use Dtyq\FlowExprEngine\Test\BaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class DefenseAgainstSSRFTest extends BaseTestCase
{
    public function testError()
    {
        $options = new DefenseAgainstSSRFOptions();
        $url = 'http://localhost';
        try {
            $defenseAgainstSSRF = new DefenseAgainstSSRF($url, $options);
            $defenseAgainstSSRF->getSafeUrl();
        } catch (FlowExprEngineException $componentException) {
            $this->assertStringContainsString('is not a public ip', $componentException->getMessage());
        }
    }

    public function testWhite()
    {
        $whiteList = [
            'localhost',
        ];
        $options = new DefenseAgainstSSRFOptions(whiteList: $whiteList);
        $url = 'http://localhost';
        $defenseAgainstSSRF = new DefenseAgainstSSRF($url, $options);
        $this->assertEquals('http://127.0.0.1', $defenseAgainstSSRF->getSafeUrl());
    }
}
