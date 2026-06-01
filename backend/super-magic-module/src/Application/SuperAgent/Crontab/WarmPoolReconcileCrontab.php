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
 * Warm-pool reconcile crontab.
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
 * The same tick also runs a SECOND, independent reconcile pass over
 * `claimed` rows ({@see WarmPoolSandboxAppService::reconcileClaimedOrphans()}).
 * Claimed rows are excluded from every other cleanup path once their
 * lifecycle ownership moves to the agent session, so without this pass a
 * claimed row whose pod is long gone from k8s would linger in the table
 * forever. The reconcile pass is kept separate from the ready-probe path on
 * purpose: it uses a grace period and only deletes the DB tombstone (never
 * the pod) when the gateway is explicit that the pod is gone, so it can
 * never tear down an active user session.
 *
 * Disabled by default; enable via `super-magic.warm_pool.enabled = true`.
 */
#[Crontab(
    rule: '*/30 * * * * *',
    name: 'WarmPoolReconcileCrontab',
    callback: 'execute',
    memo: '每 30 秒对账 warm-pool ready 行（死沙箱立刻 retire 让 refill 补齐），并对账 claimed 孤儿行（Pod 已不在 k8s 的仅删 DB 记录）',
)]
readonly class WarmPoolReconcileCrontab
{
    private const LOCK_KEY = 'warm_pool_reconcile_crontab_lock';

    private const LOCK_EXPIRE = 120;

    private const READY_RECONCILE_BATCH_LIMIT = 50;

    private const CLAIMED_RECONCILE_BATCH_LIMIT = 50;

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
            $result = $this->warmPoolSandboxAppService->reconcileReadyDead(self::READY_RECONCILE_BATCH_LIMIT);

            $elapsedMs = round((microtime(true) - $start) * 1000, 2);
            // Only log when something actually happened — every-30s noise
            // would drown the rest of the warm-pool logs.
            if (($result['retired'] ?? 0) > 0) {
                $this->logger->info('[WarmPoolReconcile] ready reconcile done', [
                    'elapsed_ms' => $elapsedMs,
                    'scanned' => $result['scanned'] ?? 0,
                    'retired' => $result['retired'] ?? 0,
                ]);
            }

            // Independent second pass: reclaim claimed orphan rows whose pod
            // is already gone from k8s. Failures here must not abort the
            // ready-reconcile result above, hence its own try/catch.
            try {
                $reconcile = $this->warmPoolSandboxAppService->reconcileClaimedOrphans(self::CLAIMED_RECONCILE_BATCH_LIMIT);
                if (($reconcile['reclaimed'] ?? 0) > 0) {
                    $this->logger->info('[WarmPoolReconcile] claimed reconcile done', [
                        'scanned' => $reconcile['scanned'] ?? 0,
                        'reclaimed' => $reconcile['reclaimed'] ?? 0,
                    ]);
                }
            } catch (Throwable $e) {
                $this->logger->error('[WarmPoolReconcile] claimed reconcile failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolReconcile] ready reconcile failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release(self::LOCK_KEY, $owner);
        }
    }
}
