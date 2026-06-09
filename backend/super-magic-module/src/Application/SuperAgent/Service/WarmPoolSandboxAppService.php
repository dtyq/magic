<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WarmPoolSandboxDomainService;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Background-orchestration entry-point for the warm-pool sandboxes.
 *
 * Responsibilities (all crontab / event-driven, never on the
 * user-facing request path):
 *
 *   - {@see refill()} — top the pool up to a target water-line for the
 *     latest agent image.
 *   - {@see evictExpired()} — reap rows that overshot expires_at.
 *   - {@see reconcileReadyDead()} — reconcile `ready` rows against the
 *     gateway and retire ones whose pod is already gone, so refill can
 *     fill the deficit before any user collides with a dead row.
 *   - {@see reconcileClaimedDeadPods()} — reconcile `claimed` rows
 *     whose pod the gateway already reaped (~20 min idle ceiling, k8s
 *     restart, session end) without notifying us, deleting only the
 *     stale DB tombstone so dead-pod `claimed` rows don't pile up forever.
 *   - {@see evictAgedClaimedTombstones()} — TTL-based hard cleanup that
 *     drops `claimed` tombstones older than a ceiling REGARDLESS of pod
 *     liveness, so long-lived ("resident") sandboxes whose pod is never
 *     reaped by the gateway can't grow the table without bound.
 *   - {@see invalidateStaleImageGeneration()} — drop rows whose
 *     agent_image differs from the current generation (used on image
 *     rollouts).
 *   - {@see detectImageGenerationShift()} — compare the latest gateway
 *     image with the most recently observed one in the table; used by
 *     the maintenance crontab to surface image rollouts as events.
 *
 * The request-time fast path lives in
 * {@see WarmPoolSandboxDomainService::tryAcquireAndMount()} so that
 * domain callers (e.g. AgentDomainService) don't need to depend on
 * the application layer.
 */
class WarmPoolSandboxAppService extends AbstractAppService
{
    /**
     * Soft cap for how long a warm-pool sandbox sits in the pool. After
     * expires_at the row is eligible for eviction.
     */
    private const POOL_TTL_MINUTES = 10;

    /**
     * Grace window before a `claimed` row becomes eligible for dead-pod
     * reconciliation. A freshly-claimed sandbox may legitimately still be
     * booting (and thus not yet `Running`); only rows bound longer ago than
     * this are checked, so an in-flight mount is never mistaken for a
     * reaped pod. Comfortably under the gateway's ~20 min idle ceiling.
     * Used as the default for {@see reconcileClaimedDeadPods()}.
     */
    private const CLAIMED_DEAD_POD_GRACE_MINUTES = 15;

    /**
     * Hard TTL (in hours) after which a `claimed` tombstone is dropped from
     * the table regardless of whether its pod is still alive. Long-lived
     * ("resident") sandboxes never get reaped by the gateway, so their
     * `claimed` rows would otherwise accumulate forever. The row is purely a
     * tombstone once the mount succeeds — nothing reads it back — so a
     * generous default keeps it around long enough for debugging while still
     * bounding table growth. Used as the default for {@see evictAgedClaimedTombstones()}.
     */
    private const CLAIMED_TOMBSTONE_TTL_HOURS = 6;

    /**
     * Hard ceiling on each refill burst so a stampede of new requests
     * doesn't unleash N pod creates at once.
     */
    private const REFILL_BURST = 5;

    private LoggerInterface $logger;

    public function __construct(
        private readonly WarmPoolSandboxDomainService $domain,
        private readonly SandboxGatewayInterface $gateway,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('warm-pool-sandbox');
    }

    /**
     * Top up the pool to `targetSize` for the current latest agent image.
     * Returns a summary of what we tried to do.
     */
    public function refill(int $targetSize): array
    {
        $images = $this->gateway->getLatestImages();
        $latestImage = $images['agent_image'];
        $latestAgfsImage = $images['agfs_image'];
        if ($latestImage === '' || $latestAgfsImage === '') {
            $this->logger->warning('[WarmPoolSandbox] Refill skipped: unable to resolve latest agent/agfs image', [
                'agent_image' => $latestImage,
                'agfs_image' => $latestAgfsImage,
            ]);
            return ['skipped' => 'no_latest_image', 'created' => 0];
        }

        $available = $this->domain->countAvailableForImage($latestImage, $latestAgfsImage);
        $deficit = max(0, $targetSize - $available);
        $burst = min($deficit, self::REFILL_BURST);
        $created = 0;
        $errors = [];

        for ($i = 0; $i < $burst; ++$i) {
            // Generate sandbox_id locally so the gateway-side pod name is
            // predictable and so a future reconciler can map orphan pods
            // back to a PHP-known id.
            $sandboxId = (string) IdGenerator::getSnowId();
            $startedAt = microtime(true);
            $result = $this->gateway->createWarmPoolSandbox($sandboxId);
            if (! $result->isSuccess()) {
                $errors[] = $result->getMessage();
                $this->logger->error('[WarmPoolSandbox] createWarmPoolSandbox failed', [
                    'sandbox_id' => $sandboxId,
                    'code' => $result->getCode(),
                    'message' => $result->getMessage(),
                ]);
                continue;
            }
            $sandboxName = (string) ($result->getDataValue('sandbox_name') ?? '');
            $image = (string) ($result->getDataValue('agent_image') ?? $latestImage);
            $agfsImage = (string) ($result->getDataValue('agfs_image') ?? $latestAgfsImage);

            try {
                // sandbox-gateway returns once the agfs-server inside the pod
                // is responsive, so we can fast-forward straight to ready.
                $entity = $this->domain->recordCreating($sandboxId, $sandboxName, $image, $agfsImage, self::POOL_TTL_MINUTES);
                if ($entity->getId() !== null) {
                    $provisionDurationMs = (int) round((microtime(true) - $startedAt) * 1000);
                    $this->domain->markReady($entity->getId(), $provisionDurationMs);
                }
                ++$created;
            } catch (Throwable $e) {
                $this->logger->error('[WarmPoolSandbox] Failed to persist warm-pool sandbox row', [
                    'sandbox_id' => $sandboxId,
                    'error' => $e->getMessage(),
                ]);
                $errors[] = $e->getMessage();
            }
        }

        $this->logger->info('[WarmPoolSandbox] Refill summary', [
            'image' => $latestImage,
            'agfs_image' => $latestAgfsImage,
            'available_before' => $available,
            'target' => $targetSize,
            'created' => $created,
            'errors' => $errors,
        ]);

        return [
            'image' => $latestImage,
            'agfs_image' => $latestAgfsImage,
            'available_before' => $available,
            'target' => $targetSize,
            'created' => $created,
            'errors' => $errors,
        ];
    }

    /**
     * Reap warm-pool sandboxes that overshot expires_at or were marked dead.
     */
    public function evictExpired(int $limit = 100): array
    {
        $rows = $this->domain->listExpired($limit);
        $deleted = 0;
        foreach ($rows as $row) {
            if ($this->forceDelete($row, 'expired')) {
                ++$deleted;
            }
        }
        if ($deleted > 0) {
            $this->logger->info('[WarmPoolSandbox] Evicted expired warm-pool sandboxes', ['count' => $deleted]);
        }
        return ['deleted' => $deleted];
    }

    /**
     * Reconcile a batch of `ready` rows against the gateway and retire the
     * ones whose underlying pod is gone (k8s cluster restart, gateway-side
     * idle reaper, manual pod kill, etc.).
     *
     * Retired rows are deleted from the DB by {@see WarmPoolSandboxDomainService::retireClaimed()},
     * so the next refill tick will see the deficit and create fresh pods,
     * without needing a user request to surface the breakage first.
     *
     * Network failures are treated as "inconclusive — assume alive": we do
     * not retire on a transport error, otherwise a flaky gateway would
     * empty the entire pool.
     */
    public function reconcileReadyDead(int $limit = 50): array
    {
        $rows = $this->domain->listReadyForReconcile($limit);
        if ($rows === []) {
            return ['scanned' => 0, 'retired' => 0];
        }

        $sandboxIds = array_map(fn (WarmPoolSandboxEntity $row) => $row->getSandboxId(), $rows);

        try {
            $batch = $this->gateway->getBatchSandboxStatus($sandboxIds);
        } catch (Throwable $e) {
            $this->logger->warning('[WarmPoolSandbox] Ready reconcile skipped: gateway batch-status threw', [
                'error' => $e->getMessage(),
                'scanned' => count($sandboxIds),
            ]);
            return ['scanned' => count($sandboxIds), 'retired' => 0, 'skipped' => 'gateway_error'];
        }

        if (! $batch->isSuccess()) {
            $this->logger->warning('[WarmPoolSandbox] Ready reconcile skipped: gateway batch-status returned error', [
                'code' => $batch->getCode(),
                'message' => $batch->getMessage(),
                'scanned' => count($sandboxIds),
            ]);
            return ['scanned' => count($sandboxIds), 'retired' => 0, 'skipped' => 'gateway_error'];
        }

        $aliveIds = array_flip($batch->getRunningSandboxIds());
        $retired = 0;
        foreach ($rows as $row) {
            if (isset($aliveIds[$row->getSandboxId()])) {
                continue;
            }
            try {
                $this->domain->retireClaimed($row, 'reconcile_dead');
                ++$retired;
            } catch (Throwable $e) {
                $this->logger->warning('[WarmPoolSandbox] Ready reconcile retire failed', [
                    'sandbox_id' => $row->getSandboxId(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($retired > 0) {
            $this->logger->info('[WarmPoolSandbox] Reconciled dead ready warm-pool sandboxes', [
                'scanned' => count($rows),
                'retired' => $retired,
            ]);
        }

        return [
            'scanned' => count($rows),
            'retired' => $retired,
        ];
    }

    /**
     * Reconcile dead-pod `claimed` rows — DB tombstones whose underlying pod
     * is already gone from k8s (session ended, idle-reaped, cluster restart)
     * but whose row was never cleaned up, because claimed rows are
     * intentionally excluded from every other warm-pool cleanup path once
     * their lifecycle ownership moves to the agent session at claim time.
     *
     * Distinct from {@see evictAgedClaimedTombstones()}: this pass acts only
     * on rows the gateway CONFIRMS are dead, never on still-alive pods.
     *
     * This is deliberately NOT folded into {@see reconcileReadyDead()}:
     *
     *   - It only acts on rows whose `bound_at` is older than
     *     {@see CLAIMED_DEAD_POD_GRACE_MINUTES}, so a freshly-claimed sandbox
     *     still booting (and thus legitimately not yet `Running`) is never touched.
     *   - It only deletes when the gateway EXPLICITLY reports the pod as
     *     gone (`NotFound`/`Exited`). `Pending`/`Running`/`Unknown` or an
     *     absent entry are treated as "still alive / inconclusive" so a flaky
     *     gateway can never wipe active sessions.
     *   - It deletes ONLY the DB row and never calls `deleteSandbox`: the pod
     *     no longer belongs to the warm pool, so tearing it down here would be
     *     wrong (and it is already gone anyway).
     */
    public function reconcileClaimedDeadPods(int $limit = 50, int $graceMinutes = self::CLAIMED_DEAD_POD_GRACE_MINUTES): array
    {
        $cutoff = date('Y-m-d H:i:s', time() - $graceMinutes * 60);
        $rows = $this->domain->listClaimedForReconcile($cutoff, $limit);
        if ($rows === []) {
            return ['scanned' => 0, 'reclaimed' => 0];
        }

        $sandboxIds = array_map(fn (WarmPoolSandboxEntity $row) => $row->getSandboxId(), $rows);

        try {
            $batch = $this->gateway->getBatchSandboxStatus($sandboxIds);
        } catch (Throwable $e) {
            $this->logger->warning('[WarmPoolSandbox] Reconcile skipped: gateway batch-status threw', [
                'error' => $e->getMessage(),
                'scanned' => count($sandboxIds),
            ]);
            return ['scanned' => count($sandboxIds), 'reclaimed' => 0, 'skipped' => 'gateway_error'];
        }

        if (! $batch->isSuccess()) {
            $this->logger->warning('[WarmPoolSandbox] Reconcile skipped: gateway batch-status returned error', [
                'code' => $batch->getCode(),
                'message' => $batch->getMessage(),
                'scanned' => count($sandboxIds),
            ]);
            return ['scanned' => count($sandboxIds), 'reclaimed' => 0, 'skipped' => 'gateway_error'];
        }

        $statusMap = $batch->getStatusMap();
        $reclaimed = 0;
        foreach ($rows as $row) {
            $status = $statusMap[$row->getSandboxId()] ?? null;
            // Only reclaim when the gateway is explicit that the pod is gone.
            if (! in_array($status, [SandboxStatus::NOT_FOUND, SandboxStatus::EXITED], true)) {
                continue;
            }
            $id = $row->getId();
            if ($id === null) {
                continue;
            }
            // DB-row-only cleanup — see method docblock for why we must not
            // call gateway->deleteSandbox here.
            $this->domain->deleteEntry($id);
            ++$reclaimed;
        }

        if ($reclaimed > 0) {
            $this->logger->info('[WarmPoolSandbox] Reconciled dead-pod claimed rows', [
                'scanned' => count($rows),
                'reclaimed' => $reclaimed,
            ]);
        }

        return [
            'scanned' => count($rows),
            'reclaimed' => $reclaimed,
        ];
    }

    /**
     * Hard-evict aged `claimed` tombstone rows whose bound_at is older than
     * the TTL, REGARDLESS of whether the underlying pod is still alive.
     *
     * This complements {@see reconcileClaimedDeadPods()} (which only deletes
     * when the gateway confirms the pod is gone). Long-lived "resident"
     * sandboxes are never reaped by the gateway, so their pod stays
     * `Running` forever and the dead-pod reconciler can never touch the row —
     * leaving the table to grow without bound. Once a warm-pool sandbox is
     * claimed and mounted its row is a pure tombstone: nothing reads it back
     * (lifecycle ownership has moved to the agent session), so deleting the
     * DB row here is safe and never affects the live session.
     *
     * Like the dead-pod reconciler, this deletes ONLY the DB row and never
     * calls `deleteSandbox`: the pod no longer belongs to the warm pool and
     * may well be an active resident session we must not tear down.
     *
     * @param int $ttlHours rows bound longer ago than this are evicted; <= 0 disables the pass
     */
    public function evictAgedClaimedTombstones(int $ttlHours = self::CLAIMED_TOMBSTONE_TTL_HOURS, int $limit = 100): array
    {
        if ($ttlHours <= 0) {
            return ['scanned' => 0, 'deleted' => 0, 'skipped' => 'disabled'];
        }

        $cutoff = date('Y-m-d H:i:s', time() - $ttlHours * 3600);
        $rows = $this->domain->listClaimedForReconcile($cutoff, $limit);
        if ($rows === []) {
            return ['scanned' => 0, 'deleted' => 0];
        }

        $deleted = 0;
        foreach ($rows as $row) {
            $id = $row->getId();
            if ($id === null) {
                continue;
            }
            // DB-row-only cleanup — the pod may be a live resident session,
            // so we must NOT call gateway->deleteSandbox here.
            $this->domain->deleteEntry($id);
            ++$deleted;
        }

        if ($deleted > 0) {
            $this->logger->info('[WarmPoolSandbox] Evicted aged claimed tombstone rows', [
                'ttl_hours' => $ttlHours,
                'cutoff' => $cutoff,
                'scanned' => count($rows),
                'deleted' => $deleted,
            ]);
        }

        return [
            'scanned' => count($rows),
            'deleted' => $deleted,
        ];
    }

    /**
     * Drop all warm-pool sandboxes whose image generation does not match the
     * current one; used when sandbox-gateway rolls out a new agent OR agfs
     * image. A pooled row is stale if EITHER image differs from the current
     * generation.
     */
    public function invalidateStaleImageGeneration(string $currentImage, string $currentAgfsImage): array
    {
        if ($currentImage === '' || $currentAgfsImage === '') {
            return ['deleted' => 0, 'skipped' => 'no_current_image'];
        }
        $rows = $this->domain->listStaleImage($currentImage, $currentAgfsImage, 200);
        $deleted = 0;
        foreach ($rows as $row) {
            if ($this->forceDelete($row, 'stale_image:' . $currentImage . '|' . $currentAgfsImage)) {
                ++$deleted;
            }
        }
        if ($deleted > 0) {
            $this->logger->info('[WarmPoolSandbox] Invalidated stale-image warm-pool sandboxes', [
                'current_image' => $currentImage,
                'current_agfs_image' => $currentAgfsImage,
                'deleted' => $deleted,
            ]);
        }
        return ['deleted' => $deleted, 'current_image' => $currentImage, 'current_agfs_image' => $currentAgfsImage];
    }

    /**
     * Detect whether the gateway has rolled to a new image generation since
     * we last persisted a warm-pool row. A generation is the pair
     * (agent_image, agfs_image); a shift in EITHER counts. Returns the
     * previous + current images when a shift occurred, or null otherwise.
     *
     * @return null|array{previous_agent_image: ?string, previous_agfs_image: ?string, current_agent_image: string, current_agfs_image: string}
     */
    public function detectImageGenerationShift(): ?array
    {
        $images = $this->gateway->getLatestImages();
        $latestAgent = $images['agent_image'];
        $latestAgfs = $images['agfs_image'];
        if ($latestAgent === '' || $latestAgfs === '') {
            return null;
        }
        $previousAgent = $this->domain->lastObservedAgentImage();
        $previousAgfs = $this->domain->lastObservedAgfsImage();
        $agentShifted = $previousAgent !== null && $previousAgent !== $latestAgent;
        $agfsShifted = $previousAgfs !== null && $previousAgfs !== $latestAgfs;
        if (! $agentShifted && ! $agfsShifted) {
            return null;
        }
        return [
            'previous_agent_image' => $previousAgent,
            'previous_agfs_image' => $previousAgfs,
            'current_agent_image' => $latestAgent,
            'current_agfs_image' => $latestAgfs,
        ];
    }

    public static function gatewayResultMessage(GatewayResult $result): string
    {
        return $result->getMessage();
    }

    /**
     * Drain (destroy + remove) ALL sandboxes currently sitting in the pool.
     * Claimed rows are intentionally excluded — they belong to active user
     * sessions.
     */
    public function drainAll(): array
    {
        $rows = $this->domain->listAllPooled(500);
        $deleted = 0;
        $errors = [];

        foreach ($rows as $row) {
            try {
                if ($this->forceDelete($row, 'drain_all')) {
                    ++$deleted;
                }
            } catch (Throwable $e) {
                $errors[] = $row->getSandboxId() . ': ' . $e->getMessage();
            }
        }

        if ($deleted > 0) {
            $this->logger->info('[WarmPoolSandbox] Drained warm-pool sandboxes', ['deleted' => $deleted]);
        }

        return [
            'total_found' => count($rows),
            'deleted' => $deleted,
            'errors' => $errors,
        ];
    }

    private function forceDelete(WarmPoolSandboxEntity $row, string $reason): bool
    {
        $id = $row->getId();

        // Atomically claim the row for deletion BEFORE touching the pod. The
        // transition only succeeds from pooled states (creating / ready /
        // dead); if a concurrent user request has just flipped this row to
        // `claimed`, we lose the race and must NOT delete its pod — otherwise
        // we'd rip a sandbox out from under an active chat session.
        if ($id !== null && ! $this->domain->markForEviction($id, $reason)) {
            $this->logger->info('[WarmPoolSandbox] Skip eviction: row no longer evictable (likely claimed)', [
                'sandbox_id' => $row->getSandboxId(),
                'reason' => $reason,
            ]);
            return false;
        }

        // Row is now `dead` (or never had a DB id): safe to tear down the pod.
        // Even if the gateway call fails we still drop the DB row — the
        // pod-status reconciler in sandbox-gateway will catch orphans.
        try {
            $result = $this->gateway->deleteSandbox($row->getSandboxId());
            if (! $result->isSuccess()) {
                $this->logger->warning('[WarmPoolSandbox] deleteSandbox returned error during eviction', [
                    'sandbox_id' => $row->getSandboxId(),
                    'reason' => $reason,
                    'code' => $result->getCode(),
                    'message' => $result->getMessage(),
                ]);
            }
        } catch (Throwable $e) {
            $this->logger->warning('[WarmPoolSandbox] deleteSandbox threw during eviction', [
                'sandbox_id' => $row->getSandboxId(),
                'reason' => $reason,
                'error' => $e->getMessage(),
            ]);
        }

        if ($id === null) {
            return false;
        }
        $this->domain->deleteEntry($id);
        return true;
    }
}
