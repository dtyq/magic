<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

use PHPUnit\Event\Test\Finished;
use PHPUnit\Event\Test\FinishedSubscriber;

class TestFinishedSubscriber implements FinishedSubscriber
{
    private Channel $channel;

    public function __construct(Channel $channel)
    {
        $this->channel = $channel;
    }

    public function notify(Finished $event): void
    {
        $test = $event->test();

        // 只记录测试方法，不记录测试类
        if (! $test->isTestMethod()) {
            return;
        }

        $testName = $test->name();

        // 兼容 PHPUnit 10.5+ 的方式获取持续时间
        $duration = 0;

        // 尝试使用 durationSincePrevious 方法
        if (method_exists($event->telemetryInfo(), 'durationSincePrevious')) {
            $duration = $event->telemetryInfo()->durationSincePrevious()->asFloat();
        }
        // 如果不存在，使用备选方案（固定值）
        else {
            $duration = 0.5; // 默认使用0.5秒作为测试时间
        }

        $this->channel->addTest($testName, $duration);
    }
}
