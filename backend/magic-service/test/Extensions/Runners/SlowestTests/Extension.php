<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

use PHPUnit\Runner\Extension\Extension as PHPUnitExtension;
use PHPUnit\Runner\Extension\Facade as RunnerFacade;
use PHPUnit\Runner\Extension\ParameterCollection;
use PHPUnit\TextUI\Configuration\Configuration;

final class Extension implements PHPUnitExtension
{
    /**
     * @var ConsoleChannel
     */
    private $channel;

    public function bootstrap(
        Configuration $configuration,
        RunnerFacade $facade,
        ParameterCollection $parameters
    ): void {
        // 创建 Channel
        $rows = $parameters->has('maxTests')
            ? (int) $parameters->get('maxTests')
            : 10;

        $min = $parameters->has('minDuration')
            ? (int) $parameters->get('minDuration')
            : 200;

        $this->channel = new ConsoleChannel($rows, $min);

        // 注册事件订阅者
        $facade->registerSubscribers(
            new TestFinishedSubscriber($this->channel),
            new TestRunnerExecutionFinishedSubscriber($this->channel)
        );
    }
}
