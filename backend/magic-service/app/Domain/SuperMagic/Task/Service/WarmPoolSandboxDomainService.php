<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageTarget;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageVersion;
use App\Domain\SuperMagic\Task\Entity\ValueObject\WarmPoolSandboxStatus;
use App\Domain\SuperMagic\Task\Entity\WarmPoolSandboxEntity;
use App\Domain\SuperMagic\Task\Repository\Facade\WarmPoolSandboxRepositoryInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use DateTimeImmutable;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Domain service for individual warm-pool sandbox lifecycle.
 *
 * Two surface areas:
 *
 *   1) Entity-level CRUD + state transitions used by both the refill /
 *      eviction crontab (via the App service) and request handlers:
 *      {@see recordCreating()}, {@see markReady()}, {@see markDead()},
 *      {@see releaseClaim()}, {@see listExpired()}, {@see listStaleImage()},
 *      etc.
 *
 *   2) The request-time **fast-path** primitive
 *      {@see tryAcquireAndMount()} which atomically claims a ready
 *      sandbox, drives the gateway-side mount, and rolls back the row
 *      on failure. This lives in the domain layer (rather than the
 *      application layer) so domain callers — notably
 *      {@see AgentDomainService::ensureSandboxInitialized()} — can
 *      consume it without taking a hard dependency on the application
 *      layer, preserving the domain ← application dependency rule.
 *
 * The gateway dependency is on the Infrastructure-facing
 * {@see SandboxGatewayInterface} port; the domain talks only to that
 * contract, never to a concrete HTTP client.
 */
class WarmPoolSandboxDomainService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly WarmPoolSandboxRepositoryInterface $repository,
        private readonly SandboxGatewayInterface $gateway,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('warm-pool-sandbox');
    }

    /**
     * Persist a freshly-issued warm-pool sandbox in `creating` state.
     */
    public function recordCreating(
        string $sandboxId,
        string $sandboxName,
        string $agentImage,
        string $agfsImage,
        int $ttlMinutes
    ): WarmPoolSandboxEntity {
        $now = new DateTimeImmutable();
        $entity = new WarmPoolSandboxEntity();
        $entity->setSandboxId($sandboxId);
        $entity->setSandboxName($sandboxName);
        $entity->setAgentImage($agentImage);
        $entity->setAgfsImage($agfsImage);
        $entity->setStatus(WarmPoolSandboxStatus::Creating->value);
        $entity->setCreatedAt($now->format('Y-m-d H:i:s'));
        $entity->setExpiresAt($now->modify(sprintf('+%d minutes', $ttlMinutes))->format('Y-m-d H:i:s'));
        return $this->repository->insert($entity);
    }

    public function markReady(int $id, ?int $provisionDurationMs = null, ?string $sandboxName = null, ?string $agentImage = null, ?string $agfsImage = null): void
    {
        $this->repository->markReady($id, $provisionDurationMs, $sandboxName, $agentImage, $agfsImage);
    }

    public function markDead(int $id, string $reason): void
    {
        $this->repository->updateStatus($id, WarmPoolSandboxStatus::Dead->value, $reason);
    }

    /**
     * Flip a `creating` row to `error` after a failed gateway create. The row
     * is kept (rather than deleted) so the pod it may have leaked stays
     * traceable for the cleanup pass and so the refill circuit breaker can
     * count it as a recent failure.
     */
    public function markError(int $id, string $reason): void
    {
        $this->repository->updateStatus($id, WarmPoolSandboxStatus::Error->value, mb_substr($reason, 0, 250));
    }

    /**
     * Number of `error` rows whose updated_at falls within the last
     * `$withinSeconds`. Drives the refill circuit breaker entirely off the
     * DB, so it survives restarts and self-heals as old failures age out.
     */
    public function countRecentErrors(int $withinSeconds): int
    {
        if ($withinSeconds <= 0) {
            return 0;
        }
        $since = date('Y-m-d H:i:s', time() - $withinSeconds);
        return $this->repository->countByStatusUpdatedSince(WarmPoolSandboxStatus::Error->value, $since);
    }

    /**
     * `error` rows whose updated_at is older than `$updatedBefore`, oldest
     * first. Used by the cleanup pass to reap leaked pods + GC tombstones
     * once they have aged past the retention window.
     *
     * @return WarmPoolSandboxEntity[]
     */
    public function listErrorForCleanup(string $updatedBefore, int $limit = 100): array
    {
        return $this->repository->findByStatusUpdatedBefore(WarmPoolSandboxStatus::Error->value, $updatedBefore, $limit);
    }

    /**
     * Atomically claim a pooled row for eviction by flipping it to `dead`.
     * Only succeeds from creating / ready / dead; returns false when the row
     * has been concurrently claimed by a user request, signalling the caller
     * to leave that sandbox alone instead of tearing its pod down.
     */
    public function markForEviction(int $id, string $reason): bool
    {
        return $this->repository->markForEviction($id, $reason);
    }

    public function findBySandboxId(string $sandboxId): ?WarmPoolSandboxEntity
    {
        return $this->repository->findBySandboxId($sandboxId);
    }

    public function countAvailableForImage(string $agentImage, string $agfsImage): int
    {
        // creating + ready both contribute to "soon-available" headroom so
        // refill doesn't over-shoot while pods are still booting.
        return $this->repository->countByImageAndStatuses($agentImage, $agfsImage, [
            WarmPoolSandboxStatus::Creating->value,
            WarmPoolSandboxStatus::Ready->value,
        ]);
    }

    /**
     * Atomically claim a ready sandbox for the given image generation
     * (agent_image AND agfs_image).
     */
    public function claimOneReady(
        string $agentImage,
        string $agfsImage,
        string $userId,
        string $projectId,
        ?string $topicId = null
    ): ?WarmPoolSandboxEntity {
        return $this->repository->claimOneReady(
            $agentImage,
            $agfsImage,
            $userId,
            $projectId,
            date('Y-m-d H:i:s'),
            $topicId
        );
    }

    /**
     * Roll a previously-claimed row back to ready (e.g. when the mount step
     * fails after a successful claim).  Returns false if the row was already
     * progressed beyond claimed.
     */
    public function releaseClaim(int $id): bool
    {
        return $this->repository->updateStatus($id, WarmPoolSandboxStatus::Ready->value);
    }

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function listExpired(int $limit = 100): array
    {
        return $this->repository->findExpired(date('Y-m-d H:i:s'), $limit);
    }

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function listStaleImage(string $currentAgentImage, string $currentAgfsImage, int $limit = 100): array
    {
        return $this->repository->findReadyExcludingImage($currentAgentImage, $currentAgfsImage, $limit);
    }

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function listForImage(string $agentImage, string $agfsImage, int $limit = 200): array
    {
        return $this->repository->findByImageAndStatuses($agentImage, $agfsImage, [
            WarmPoolSandboxStatus::Creating->value,
            WarmPoolSandboxStatus::Ready->value,
        ], $limit);
    }

    public function deleteEntry(int $id): void
    {
        $this->repository->deleteById($id);
    }

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function listAllPooled(int $limit = 500): array
    {
        return $this->repository->findAllPooled($limit);
    }

    /**
     * Ready rows to reconcile against the gateway. Used by the reconcile
     * crontab to detect rows whose underlying pod was already reaped (e.g.
     * k8s restart, gateway-side idle reaper) so they can be retired and
     * refilled immediately.
     *
     * @return WarmPoolSandboxEntity[]
     */
    public function listReadyForReconcile(int $limit = 100): array
    {
        return $this->repository->findReadyForReconcile($limit);
    }

    /**
     * `claimed` rows whose bound_at is at or before the cutoff, oldest first.
     * Used by the reconcile path to find claimed orphans (pods already gone
     * from k8s) without touching rows still completing their mount/boot.
     *
     * @return WarmPoolSandboxEntity[]
     */
    public function listClaimedForReconcile(string $boundBefore, int $limit = 100): array
    {
        return $this->repository->findClaimedBefore($boundBefore, $limit);
    }

    public function lastObservedAgentImage(): ?string
    {
        return $this->repository->findLatestAgentImage();
    }

    public function lastObservedAgfsImage(): ?string
    {
        return $this->repository->findLatestAgfsImage();
    }

    /**
     * Request-time fast path.
     *
     * Returns the bound sandbox_id on success, or null when no warm-pool
     * sandbox could be claimed/mounted — the caller should then fall back
     * to the regular cold-create path.
     *
     * On any post-claim failure (mount call throws, mount call returns a
     * non-success result) the row is retired (marked dead + best-effort
     * delete via gateway + DB row deleted), so a failed mount never
     * leaves a poisoned row in the pool.
     *
     * @param DataIsolation $dataIsolation per-call user identity (token auto-fetched by create())
     * @param string $projectId 实际项目 ID
     * @param string $projectSpaceRootFileId 项目空间 root file id
     * @param string $userSpaceRootFileId 用户空间 root file id（可空）
     * @param array<string, string> $labels Extra pod labels (e.g. ['topic-id' => '123']) stamped onto the pod at mount time
     * @param null|SandboxImageTarget $images 领取条件与回写的目标镜像；null=按网关当前发布版本。
     *                                        指定镜像时只会领到同一代镜像的池 pod，池里没有就返回 null 交给冷创建
     * @param null|array $sandboxImages 出参：领到的池 pod 所代表的镜像对（未命中时为 null）
     */
    public function tryAcquireAndMount(
        DataIsolation $dataIsolation,
        string $projectId,
        string $projectSpaceRootFileId,
        string $userSpaceRootFileId,
        string $topicSpaceRootFileId = '',
        array $labels = [],
        ?string $topicId = null,
        ?array &$sandboxImages = null,
        ?SandboxImageTarget $images = null
    ): ?string {
        $sandboxImages = null;
        // Per-call user identity for mountWarmPoolSandbox — that call
        // reaches into a user-bound pod (agfs /api/v1/mount) so the
        // pod's in-pod middleware expects User-Authorization.
        // Caller is expected to have stamped the token on $dataIsolation.
        $userId = $dataIsolation->getCurrentUserId();

        // 领取条件就是"镜像对"：池子里的 pod 用哪一代镜像预热，就只能服务哪一代请求。
        // 调用方传入目标时以目标为准（例如发布重启指定了某一版），否则按网关当前发布版本。
        // 目标不完整时无法安全匹配，直接放弃温池、交给冷创建按调用方的镜像构建。
        $target = $images ?? SandboxImageTarget::release($this->gateway->getLatestImages());
        if (! $target->isComplete()) {
            return null;
        }

        $claimed = $this->claimOneReady($target->getAgentImage(), $target->getAgfsImage(), $userId, $projectId, $topicId);
        if ($claimed === null) {
            return null;
        }

        $sandboxId = $claimed->getSandboxId();
        $this->logger->info('[WarmPoolSandbox] Claimed warm-pool sandbox, attempting mount', [
            'sandbox_id' => $sandboxId,
            'user_id' => $userId,
            'project_id' => $projectId,
            'space_ids' => [
                'project' => $projectSpaceRootFileId,
                'user' => $userSpaceRootFileId,
                'topic' => $topicSpaceRootFileId,
            ],
        ]);

        try {
            $mountResult = $this->gateway->mountWarmPoolSandbox(
                $dataIsolation,
                $sandboxId,
                $projectId,
                $projectSpaceRootFileId,
                $userSpaceRootFileId,
                $topicSpaceRootFileId,
                $labels
            );
        } catch (Throwable $e) {
            $this->logger->error('[WarmPoolSandbox] Mount threw, retiring claimed sandbox', [
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
            ]);
            $this->retireClaimed($claimed, 'mount_threw:' . substr($e->getMessage(), 0, 200));
            return null;
        }

        if (! $mountResult->isSuccess()) {
            $this->logger->error('[WarmPoolSandbox] Mount failed, retiring claimed sandbox', [
                'sandbox_id' => $sandboxId,
                'code' => $mountResult->getCode(),
                'message' => $mountResult->getMessage(),
            ]);
            // The pod may be in an undefined state after a failed mount; tear
            // it down rather than risk handing it to a different user.
            $this->retireClaimed($claimed, 'mount_failed:' . $mountResult->getMessage());
            return null;
        }

        // 池 pod 的镜像与目标一致才可能被领到，所以这里直接回写目标镜像。
        $sandboxImages = [
            SandboxImageVersion::AGENT_IMAGE_KEY => $target->getAgentImage(),
            SandboxImageVersion::AGFS_IMAGE_KEY => $target->getAgfsImage(),
        ];

        $this->logger->info('[WarmPoolSandbox] Mount succeeded, fast path completed', [
            'sandbox_id' => $sandboxId,
        ]);
        return $sandboxId;
    }

    /**
     * Tear down a claimed-but-broken row: mark dead in DB, best-effort
     * delete pod via gateway, then drop the DB entry. Used by
     * {@see tryAcquireAndMount()} after a failed mount, and by the
     * reconcile crontab (system-level, no bound user).
     *
     * The underlying gateway call ({@see SandboxGatewayInterface::deleteSandbox()})
     * is a control-plane call (k8s API) and does not need a
     * DataIsolation.
     */
    public function retireClaimed(WarmPoolSandboxEntity $row, string $reason): void
    {
        $id = $row->getId();
        if ($id !== null) {
            $this->markDead($id, substr($reason, 0, 250));
        }
        // Best-effort tear-down — if k8s says the pod is already gone we
        // simply continue.
        try {
            $this->gateway->deleteSandbox($row->getSandboxId());
        } catch (Throwable $e) {
            $this->logger->warning('[WarmPoolSandbox] deleteSandbox failed for retired warm-pool sandbox', [
                'sandbox_id' => $row->getSandboxId(),
                'error' => $e->getMessage(),
            ]);
        }
        if ($id !== null) {
            $this->deleteEntry($id);
        }
    }
}
