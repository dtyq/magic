<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit\SuperMagic\SandboxRestart;

use App\Application\SuperMagic\Task\Service\SandboxRestartBatchRunner;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * 批处理执行器：无协程时串行、异常不拖垮整批、结果与输入同序.
 *
 * 并发路径依赖 Swoole/Swow 协程运行时，单测进程没有，因此这里只钉住
 * "没有协程时绝不假装并发"以及异常隔离这两条真正的行为契约。
 *
 * @internal
 */
class SandboxRestartBatchRunnerTest extends TestCase
{
    public function testEmptyInputReturnsEmptyResult(): void
    {
        self::assertSame([], (new SandboxRestartBatchRunner())->run([], 8, static fn ($item) => $item));
    }

    public function testRunsInInputOrderWhenConcurrencyUnavailable(): void
    {
        $seen = [];
        $results = (new SandboxRestartBatchRunner())->run(
            [101 => 'a', 102 => 'b', 103 => 'c'],
            4,
            static function (string $item) use (&$seen): string {
                $seen[] = $item;
                return strtoupper($item);
            }
        );

        self::assertSame(['a', 'b', 'c'], $seen, '没有协程时必须老实串行');
        self::assertSame([101 => 'A', 102 => 'B', 103 => 'C'], $results, '结果保留输入 key');
    }

    public function testFailingItemDoesNotAbortTheBatch(): void
    {
        $results = (new SandboxRestartBatchRunner())->run(
            ['ok-1', 'boom', 'ok-2'],
            1,
            static function (string $item): string {
                if ($item === 'boom') {
                    throw new RuntimeException('item exploded');
                }
                return $item;
            }
        );

        self::assertSame(['ok-1', null, 'ok-2'], array_values($results), '抛异常的任务记为 null，其余继续');
    }
}
