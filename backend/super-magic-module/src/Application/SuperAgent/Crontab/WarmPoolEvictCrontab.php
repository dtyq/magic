<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Crontab;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WarmPoolSandboxAppService;
use Hyperf\Crontab\Annotation\Crontab;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Warm-pool evict crontab.
 *
 * Periodically deletes expired warm-pool rows in small batches so the
 * refill cron always sees an accurate "current vs target" count.
 *
 * Disabled by default; enable via `super-magic.warm_pool.enabled = true`.
 */
#[Crontab(
    rule: '*/5 * * * * *',
    name: 'WarmPoolEvictCrontab',
    callback: 'execute',
    memo: '每 5 秒清理 warm-pool 过期记录',
)]
readonly class WarmPoolEvictCrontab
{
    private const LOCK_KEY = 'warm_pool_evict_crontab_lock';

    private const LOCK_EXPIRE = 120;

    private const EVICT_BATCH_LIMIT = 200;

    protected LoggerInterface $logger;

    public function __construct(
        private WarmPoolSandboxAppService $warmPoolSandboxAppService,
        private LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function execute(): void
    {
        if (! (bool) config('super-magic.warm_pool.enabled', false)) {
            return;
        }

        $owner = IdGenerator::getUniqueId32();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_EXPIRE)) {
            return;
        }

        $start = microtime(true);
        try {
            $this->warmPoolSandboxAppService->evictExpired(self::EVICT_BATCH_LIMIT);

            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            $this->logger->info('[WarmPoolEvict] tick done', ['elapsed_ms' => $elapsedMs]);
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolEvict] tick failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }
}
