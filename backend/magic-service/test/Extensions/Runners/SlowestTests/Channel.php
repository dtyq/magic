<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Extensions\Runners\SlowestTests;

abstract class Channel
{
    /**
     * 存放慢测试.
     */
    protected array $tests = [];

    /**
     * 需要收集的最大测试数量.
     */
    protected ?int $rows;

    /**
     * 测试时间超过min毫秒的需要被收集.
     */
    protected ?int $min;

    public function __construct(?int $rows = null, ?int $min = 200)
    {
        $this->rows = $rows;
        $this->min = $min;
    }

    public function addTest(string $test, float $time): void
    {
        $time = $this->timeToMiliseconds($time);

        if ($time <= $this->min) {
            return;
        }

        $this->tests[$test] = $time;
    }

    public function finishTests(): void
    {
        $this->sortTestsBySpeed();
        $this->printResults();
    }

    protected function timeToMiliseconds(float $time): int
    {
        return (int) ($time * 1000);
    }

    protected function sortTestsBySpeed(): void
    {
        arsort($this->tests);
    }

    abstract protected function printResults(): void;

    protected function testsToPrint(): array
    {
        if ($this->rows === null) {
            return $this->tests;
        }

        return array_slice($this->tests, 0, $this->rows, true);
    }

    protected function getClassName(): string
    {
        return get_class($this);
    }
}
