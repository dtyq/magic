<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

class Console extends Channel
{
    public function __construct(?int $rows = 5, ?int $min = 200)
    {
        parent::__construct($rows, $min);
    }

    protected function printResults(): void
    {
        $tests = $this->testsToPrint();

        if (count($tests) === 0) {
            return;
        }

        printf("\n检查到慢测试 (数量: %d):\n", count($tests));

        foreach ($tests as $test => $time) {
            echo str_pad($time, 5, ' ', STR_PAD_LEFT) . " ms: {$test}" . PHP_EOL;
        }

        echo PHP_EOL;
    }
}
