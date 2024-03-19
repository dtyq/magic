<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Token\Crontab;

use App\Domain\Token\Service\MagicTokenCleanupDomainService;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Crontab\Annotation\Crontab;
use Throwable;

/**
 * 按固定频率批量清理 `magic_tokens` 表中过期数据的定时任务。
 * 采用互斥锁 + 批处理策略，避免多节点重复执行或长时间大事务。
 */
#[Crontab(
    rule: '*/10 * * * *',
    name: 'MagicTokenCleanupCrontab',
    singleton: true,
    mutexExpires: 300,
    onOneServer: true,
    callback: 'execute',
    memo: '清理 magic_tokens 过期 token'
)]
class MagicTokenCleanupCrontab
{
    use HasLogger;

    /**
     * 互斥锁 key，所有节点共用，确保任一时刻只有一个任务实例在执行。
     */
    private const LOCK_KEY = 'MagicTokenCleanupCrontab:lock';

    /**
     * 分布式锁默认持有时长（秒），需要覆盖整个批处理流程。
     */
    private const DEFAULT_LOCK_TTL = 300;

    /**
     * 单批次删除的 token 数量上限，控制单次 SQL 的体积。
     */
    private const DEFAULT_BATCH_SIZE = 500;

    /**
     * 单次任务最多执行的批次数，防止长时间占用 Worker。
     */
    private const DEFAULT_MAX_BATCHES = 20;

    public function __construct(
        private MagicTokenCleanupDomainService $magicTokenCleanupDomainService,
        private LockerInterface $locker,
    ) {
    }

    /**
     * 获取互斥锁后执行批量清理，并输出统计信息。
     */
    public function execute(): void
    {
        $lockTtl = $this->getLockTtl();
        $lockOwner = self::LOCK_KEY . '-' . gethostname() . '-' . getmypid();

        if (! $this->locker->mutexLock(self::LOCK_KEY, $lockOwner, $lockTtl)) {
            $this->logger->info('MagicTokenCleanupCrontab skipped because lock is held');
            return;
        }

        try {
            $batchSize = $this->getBatchSize();
            $maxBatches = $this->getMaxBatches();

            $stats = $this->magicTokenCleanupDomainService->cleanupExpiredTokens($batchSize, $maxBatches);

            $this->logger->info('MagicTokenCleanupCrontab finished', [
                'batch_size' => $batchSize,
                'max_batches' => $maxBatches,
                'stats' => $stats,
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('MagicTokenCleanupCrontab execution failed', [
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $lockOwner);
        }
    }

    /**
     * 目前采用约定常量，若未来需要差异化策略可在此集中调整。
     */
    private function getBatchSize(): int
    {
        return self::DEFAULT_BATCH_SIZE;
    }

    /**
     * 获取单次任务的最大批次数。
     */
    private function getMaxBatches(): int
    {
        return self::DEFAULT_MAX_BATCHES;
    }

    /**
     * 获取互斥锁的有效期，保证足够覆盖正常执行时间。
     */
    private function getLockTtl(): int
    {
        return self::DEFAULT_LOCK_TTL;
    }
}
