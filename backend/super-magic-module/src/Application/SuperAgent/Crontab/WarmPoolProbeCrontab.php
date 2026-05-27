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
 * Warm-pool liveness probe crontab.
 *
 * Periodically asks the sandbox gateway whether each ready row's pod is
 * still alive and retires the ones that are gone. This is what closes the
 * "k8s cluster restarted but DB still says READY" window: without it, the
 * refill cron sees its capacity as full (because DB ready_count == target)
 * and refuses to top up until either evictExpired() catches up (≤10 min)
 * or a user request collides with a dead row and triggers
 * {@see \Dtyq\SuperMagic\Domain\SuperAgent\Service\WarmPoolSandboxDomainService::tryAcquireAndMount()}
 * 's failure-retire path.
 *
 * Disabled by default; enable via `super-magic.warm_pool.enabled = true`.
 */
#[Crontab(
    rule: '*/30 * * * * *',
    name: 'WarmPoolProbeCrontab',
    callback: 'execute',
    memo: '每 30 秒探活 warm-pool ready 行，死沙箱立刻 retire 让 refill 补齐',
)]
readonly class WarmPoolProbeCrontab
{
    private const LOCK_KEY = 'warm_pool_probe_crontab_lock';

    private const LOCK_EXPIRE = 120;

    private const PROBE_BATCH_LIMIT = 50;

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
            $result = $this->warmPoolSandboxAppService->probeAndRetireDead(self::PROBE_BATCH_LIMIT);

            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            // Only log when something actually happened — every-30s noise
            // would drown the rest of the warm-pool logs.
            if (($result['retired'] ?? 0) > 0) {
                $this->logger->info('[WarmPoolProbe] tick done', [
                    'elapsed_ms' => $elapsedMs,
                    'probed' => $result['probed'] ?? 0,
                    'retired' => $result['retired'] ?? 0,
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolProbe] tick failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }
}
