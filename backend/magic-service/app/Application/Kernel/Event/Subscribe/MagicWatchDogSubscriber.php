<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel\Event\Subscribe;

use Hyperf\Context\ApplicationContext;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Server\Event\MainCoroutineServerStart;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\NotFoundExceptionInterface;
use Swow\Coroutine;
use Swow\Watchdog;
use WeakMap;

readonly class MagicWatchDogSubscriber implements ListenerInterface
{
    public function __construct()
    {
    }

    public function listen(): array
    {
        return [
            MainCoroutineServerStart::class,
        ];
    }

    /**
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    public function process(object $event): void
    {
        if ((bool) env('ENABLE_MAGIC_WATCHDOG', true) !== true) {
            return;
        }
        // Watchdog 的时间单位是纳秒；通过毫秒配置便于线上调整。
        $quantumMs = max(1, (int) env('MAGIC_WATCHDOG_QUANTUM_MS', 50));
        $thresholdMs = max($quantumMs, (int) env('MAGIC_WATCHDOG_THRESHOLD_MS', 500));
        $baseDelayMs = max(1, (int) env('MAGIC_WATCHDOG_BASE_DELAY_MS', 10));
        $maxDelayMs = max($baseDelayMs, (int) env('MAGIC_WATCHDOG_MAX_DELAY_MS', 500));
        $quantum = $quantumMs * 1_000_000;
        $threshold = $thresholdMs * 1_000_000;
        $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get('MagicWatchDogSubscriber');
        // 看门狗找同步阻塞的地方
        $logger->info('麦吉看门狗，启动！');
        Watchdog::run($quantum, $threshold, static function (string $blockingType) use (
            $logger,
            $baseDelayMs,
            $maxDelayMs,
        ): void {
            /** @var WeakMap<Coroutine, array{type: string, count: int, firstAt: int, lastAt: int}> $blockingStateMap */
            static $blockingStateMap;
            $blockingStateMap ??= new WeakMap();
            $coroutine = Coroutine::getCurrent();
            // hrtime(true) 在静态分析中为 int|float，显式收敛为 int，保证与状态数组声明的类型一致。
            $now = (int) hrtime(true);
            $state = $blockingStateMap[$coroutine] ?? null;
            $isNewEpisode = $state === null
                || $state['type'] !== $blockingType
                || $now - $state['lastAt'] > 2_000_000_000;
            if ($isNewEpisode) {
                // 一次性给出全部字段，避免局部赋值使状态数组退化为 array<string, float|int|string>。
                $state = [
                    'type' => $blockingType,
                    'count' => 0,
                    'firstAt' => $now,
                ];
            }
            ++$state['count'];
            $state['lastAt'] = $now;
            $blockingStateMap[$coroutine] = $state;
            $alertCount = $state['count'];
            $blockedMs = (int) (($now - $state['firstAt']) / 1_000_000);
            $delayMs = min($maxDelayMs, $baseDelayMs * (2 ** min($alertCount - 1, 30)));
            // 连续阻塞时记录类型、次数、观测时长和退避时长，便于判断阻塞严重程度。
            if ($blockingType === 'syscall' || $alertCount > 1) {
                $trace = str_replace(["\n", "\r"], ' | ', $coroutine->getTraceAsString());
                $logger->error(sprintf(
                    '麦吉看门狗 发现阻塞 协程 id:%s，类型：%s，阻塞次数：%s，已观测约：%sms，退避：%sms，trace：%s',
                    $coroutine->getId(),
                    $blockingType,
                    $alertCount,
                    $blockedMs,
                    $delayMs,
                    $trace
                ));
            }
            // Swow 重载了 usleep，它通过协程定时器等待并让出事件循环。
            usleep($delayMs * 1000);
        });
    }
}
