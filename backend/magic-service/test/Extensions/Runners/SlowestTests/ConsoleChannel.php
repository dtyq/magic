<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

/**
 * 控制台输出通道.
 */
final class ConsoleChannel extends Channel
{
    protected function printResults(): void
    {
        $tests = $this->testsToPrint();

        if (empty($tests)) {
            return;
        }

        echo "\n";
        echo "最慢的测试：\n";

        foreach ($tests as $test => $time) {
            printf("  %s: %s 毫秒\n", $test, $time);
        }
    }
}
