<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeRunnerBwrap\Tests\Unit;

use Dtyq\CodeRunnerBwrap\StatusCode;
use Dtyq\CodeRunnerBwrap\Tests\TestCase;

/**
 * @internal
 * @coversNothing
 */
class StatusCodeTest extends TestCase
{
    public function testStatusCodeValues()
    {
        $this->assertEquals(1000, StatusCode::OK->value);
        $this->assertEquals(1001, StatusCode::ERROR->value);
        $this->assertEquals(5000, StatusCode::INVALID_PARAMS->value);
        $this->assertEquals(1002001, StatusCode::EXECUTE_FAILED->value);
        $this->assertEquals(1002002, StatusCode::EXECUTE_TIMEOUT->value);
    }

    public function testTryFrom()
    {
        $this->assertEquals(StatusCode::OK, StatusCode::tryFrom(1000));
        $this->assertEquals(StatusCode::ERROR, StatusCode::tryFrom(1001));
        $this->assertEquals(StatusCode::INVALID_PARAMS, StatusCode::tryFrom(5000));
        $this->assertEquals(StatusCode::EXECUTE_FAILED, StatusCode::tryFrom(1002001));
        $this->assertEquals(StatusCode::EXECUTE_TIMEOUT, StatusCode::tryFrom(1002002));
        $this->assertNull(StatusCode::tryFrom(9999));
    }
}
