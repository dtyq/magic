<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit;

use Dtyq\CodeExecutor\ExecutionResult;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ExecutionResultTest extends TestCase
{
    public function testGetOutput(): void
    {
        $output = 'Hello World';
        $result = new ExecutionResult($output);
        $this->assertSame($output, $result->getOutput());
    }

    public function testGetDuration(): void
    {
        $duration = 150;
        $result = new ExecutionResult('', $duration);
        $this->assertSame($duration, $result->getDuration());
    }

    public function testGetResult(): void
    {
        $resultData = ['key' => 'value'];
        $result = new ExecutionResult('', 0, $resultData);
        $this->assertSame($resultData, $result->getResult());
    }

    public function testDefaultValues(): void
    {
        $result = new ExecutionResult();

        $this->assertSame('', $result->getOutput());
        $this->assertSame(0, $result->getDuration());
        $this->assertSame([], $result->getResult());
    }
}
