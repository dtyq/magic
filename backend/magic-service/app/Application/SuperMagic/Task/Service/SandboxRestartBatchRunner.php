<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use Hyperf\Coroutine\Coroutine;
use Hyperf\Coroutine\Parallel;
use Throwable;

/**
 * 批量执行的重启任务，支持有限并发.
 *
 * 为什么单独抽出来：单个沙箱重建要等到工作区 ready，耗时以十秒计；
 * 上千个沙箱串行执行不现实。但协程并发又依赖 Swoole/Swow 运行时，
 * 单测里没有协程环境，因此这里把"能不能并发"变成一个可覆写的判断，
 * 无协程时自动退化为串行，绝不静默假并发。
 *
 * @template T
 */
class SandboxRestartBatchRunner
{
    /**
     * @param array<int, mixed> $items
     * @param callable(mixed): mixed $task
     * @return array<int, mixed> 与 $items 同序的结果
     */
    public function run(array $items, int $concurrency, callable $task): array
    {
        if ($items === []) {
            return [];
        }

        $effectiveConcurrency = min(max(1, $concurrency), count($items));
        if ($effectiveConcurrency <= 1 || ! $this->canRunInParallel()) {
            $results = [];
            foreach ($items as $key => $item) {
                $results[$key] = $this->invoke($task, $item);
            }
            return $results;
        }

        $parallel = new Parallel($effectiveConcurrency);
        foreach ($items as $key => $item) {
            $parallel->add(fn () => $this->invoke($task, $item), $key);
        }

        $raw = $parallel->wait(false);

        // Parallel 只在任务抛异常时丢 key；这里兜底成 null，交给调用方按失败处理。
        $results = [];
        foreach ($items as $key => $item) {
            $results[$key] = $raw[$key] ?? null;
        }
        return $results;
    }

    /**
     * 当前进程是否具备协程运行时（没有就只能串行）.
     *
     * 先看扩展再问 Coroutine：`Coroutine::inCoroutine()` 在没装 Swoole/Swow 的
     * 进程里会直接抛 Class not found（例如纯单元测试或 `php -n` 环境），
     * 而"没有协程"本就是一个正常的、可预期的状态，不该以异常形式出现。
     */
    protected function canRunInParallel(): bool
    {
        if (! extension_loaded('swoole') && ! extension_loaded('swow')) {
            return false;
        }

        try {
            return Coroutine::inCoroutine();
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * 单个任务抛异常不能拖垮整批：转成 null 由上层记为失败.
     */
    private function invoke(callable $task, mixed $item): mixed
    {
        try {
            return $task($item);
        } catch (Throwable) {
            return null;
        }
    }
}
