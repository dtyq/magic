<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\Lifecycle;

use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessSpec;
use App\Infrastructure\Rpc\Lifecycle\GoEngineProcessStarter;
use App\Infrastructure\Rpc\Lifecycle\GoEngineStartRequest;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class GoEngineProcessStarterTest extends TestCase
{
    public function testStructuredModeStartsProcessWithoutShellSpec(): void
    {
        $starter = new GoEngineProcessStarter();
        $handle = $starter->start(new GoEngineStartRequest(GoEngineProcessSpec::structured(
            workDir: BASE_PATH,
            executable: PHP_BINARY,
            arguments: ['-r', 'usleep(200000);'],
            environment: ['MAGIC_TEST_PROCESS_SPEC' => 'structured'],
            socketPath: '/tmp/magic-test.sock',
        )));

        $this->assertNotNull($handle);
        $this->assertSame('go', $handle->pidType());
        $this->assertNotNull($handle->pid());
        $this->assertTrue($handle->isRunning());

        $handle->terminate(0);
    }
}
