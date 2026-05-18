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
 * Warm-pool refill crontab.
 *
 * Runs every second so a freshly-consumed pool slot starts refilling as
 * fast as possible. Because creating a sandbox is typically multi-second,
 * `singleton: true` naturally serializes ticks — the effective frequency
 * becomes "as soon as the previous refill finishes".
 *
 * The refill logic itself reads stock for the latest image only, so we
 * don't need a strict happens-before with image-shift / evict.
 *
 * Disabled by default; enable via `super-magic.warm_pool.enabled = true`.
 */
#[Crontab(
    rule: '* * * * * *',
    name: 'WarmPoolRefillCrontab',
    callback: 'execute',
    memo: '每秒补齐 warm-pool 至 target_size'
)]
readonly class WarmPoolRefillCrontab
{
    private const LOCK_KEY = 'warm_pool_refill_crontab_lock';

    private const LOCK_EXPIRE = 300;

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

        $targetSize = (int) config('super-magic.warm_pool.target_size', 10);
        if ($targetSize <= 0) {
            return;
        }

        $owner = IdGenerator::getUniqueId32();
        if (! $this->locker->mutexLock(self::LOCK_KEY, $owner, self::LOCK_EXPIRE)) {
            return;
        }

        $start = microtime(true);
        try {
            $this->warmPoolSandboxAppService->refill($targetSize);

            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            $this->logger->info('[WarmPoolRefill] tick done', [
                'elapsed_ms' => $elapsedMs,
                'target_size' => $targetSize,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolRefill] tick failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }
}
