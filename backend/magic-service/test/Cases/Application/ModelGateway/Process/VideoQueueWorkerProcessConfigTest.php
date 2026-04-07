<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Process;

use App\Application\ModelGateway\Process\VideoQueueWorkerProcess;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoQueueWorkerProcessConfigTest extends TestCase
{
    public function testVideoQueueWorkerProcessIsRegistered(): void
    {
        $processes = require BASE_PATH . '/config/autoload/processes.php';

        $this->assertContains(VideoQueueWorkerProcess::class, $processes);
    }
}
