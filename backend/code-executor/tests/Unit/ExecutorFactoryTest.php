<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Tests\Unit;

use Dtyq\CodeExecutor\ExecutorFactory;
use Hyperf\Contract\ConfigInterface;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 * @coversNothing
 */
class ExecutorFactoryTest extends TestCase
{
    use MockeryPHPUnitIntegration;

    public function testFactoryCreation(): void
    {
        $configMock = \Mockery::mock(ConfigInterface::class);
        $factory = new ExecutorFactory($configMock);

        $this->assertInstanceOf(ExecutorFactory::class, $factory);
    }
}
