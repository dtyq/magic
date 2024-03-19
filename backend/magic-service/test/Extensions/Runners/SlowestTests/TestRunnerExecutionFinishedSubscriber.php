<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

use PHPUnit\Event\TestRunner\ExecutionFinished;
use PHPUnit\Event\TestRunner\ExecutionFinishedSubscriber;

class TestRunnerExecutionFinishedSubscriber implements ExecutionFinishedSubscriber
{
    private Channel $channel;

    public function __construct(Channel $channel)
    {
        $this->channel = $channel;
    }

    public function notify(ExecutionFinished $event): void
    {
        $this->channel->finishTests();
    }
}
