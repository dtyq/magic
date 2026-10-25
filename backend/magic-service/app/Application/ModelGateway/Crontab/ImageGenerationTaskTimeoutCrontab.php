<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Crontab;

use App\Domain\ModelGateway\Service\ImageGenerationTaskDomainService;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Throwable;

/**
 * 定时清扫长时间未完成的生图任务。
 *
 * 生图链路存在三类「僵尸任务」：sandbox 代码片段超时、Pod 重启丢失协程、
 * 用户重新发消息后 Agent 放弃原任务。它们的协程已经不存在，只能由定时任务兜底置为失败，
 * 否则用户侧会一直停留在「生成中」。
 *
 * 每 30 分钟执行一次，把创建后超过 30 分钟仍未完成的任务批量置为失败；
 * 除 Hyperf 自身的 singleton / onOneServer 之外，再加一把 Redis 互斥锁防止并发执行。
 */
#[Crontab(
    rule: '*/30 * * * *',
    name: 'ImageGenerationTaskTimeoutCrontab',
    singleton: true,
    onOneServer: true,
    mutexExpires: 300,
    callback: 'execute',
    memo: '清扫超过 30 分钟仍未完成的生图任务'
)]
class ImageGenerationTaskTimeoutCrontab
{
    use HasLogger;

    /**
     * 互斥锁 key，所有节点共用，确保任一时刻只有一个实例在执行。
     */
    private const LOCK_KEY = 'ImageGenerationTaskTimeoutCrontab:lock';

    /**
     * 分布式锁默认持有时长（秒），需要覆盖整个批处理流程。
     */
    private const LOCK_TTL = 300;

    public function __construct(
        private ImageGenerationTaskDomainService $imageGenerationTaskDomainService,
        private LockerInterface $locker,
    ) {
    }

    public function execute(): void
    {
        $lockOwner = self::LOCK_KEY . '-' . gethostname() . '-' . getmypid();

        if (! $this->locker->mutexLock(self::LOCK_KEY, $lockOwner, self::LOCK_TTL)) {
            $this->logger->info('ImageGenerationTaskTimeoutCrontab skipped because lock is held');
            return;
        }

        try {
            $swept = $this->imageGenerationTaskDomainService->sweepTimedOutTasks();

            if ($swept > 0) {
                $this->logger->info('ImageGenerationTaskTimeoutCrontab finished', [
                    'swept' => $swept,
                ]);
            }
        } catch (Throwable $throwable) {
            $this->logger->error('ImageGenerationTaskTimeoutCrontab execution failed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $lockOwner);
        }
    }
}
