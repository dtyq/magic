<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit\Enums;

use Dtyq\CodeExecutor\Enums\StatusCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class StatusCodeTest extends TestCase
{
    public function testStatusCodeValues(): void
    {
        $this->assertSame(1000, StatusCode::OK->value);
        $this->assertSame(1001, StatusCode::ERROR->value);
        $this->assertSame(5000, StatusCode::INVALID_PARAMS->value);
        $this->assertSame(1002001, StatusCode::EXECUTE_FAILED->value);
        $this->assertSame(1002002, StatusCode::EXECUTE_TIMEOUT->value);
    }

    public function testStatusCodeCases(): void
    {
        $cases = StatusCode::cases();

        $this->assertCount(5, $cases);
        $this->assertContains(StatusCode::OK, $cases);
        $this->assertContains(StatusCode::ERROR, $cases);
        $this->assertContains(StatusCode::INVALID_PARAMS, $cases);
        $this->assertContains(StatusCode::EXECUTE_FAILED, $cases);
        $this->assertContains(StatusCode::EXECUTE_TIMEOUT, $cases);
    }
}
