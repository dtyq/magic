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
        $quantum = 10 * 1000 * 1000; // 单位：毫秒
        $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get('MagicWatchDogSubscriber');
        // 看门狗找同步阻塞的地方
        $logger->info('麦吉看门狗，启动！');
        $alertCountMap = new WeakMap();
        Watchdog::run($quantum * 5, 0, static function () use (&$alertCountMap, $logger) {
            $coroutine = Coroutine::getCurrent();
            $alertCount = ($alertCountMap[$coroutine] ??= 0) + 1;
            $alertCountMap[$coroutine] = $alertCount;
            // 当单个协程运行超过 $millSeconds 时，会触发看门狗，打印协程调用栈
            if ($alertCount > 1) {
                $trace = str_replace(["\n", "\r"], ' | ', $coroutine->getTraceAsString());
                $logger->error(sprintf(
                    '麦吉看门狗 发现阻塞 协程 id:%s，同个协程阻塞次数：%s trace :%s ',
                    $coroutine->getId(),
                    $alertCount,
                    $trace
                ));
            }
            // 让出时间片，让其他协程有机会执行
            $millSeconds = 10 * 1000; // 10 毫秒
            usleep($millSeconds * $alertCount);
        });
    }
}
