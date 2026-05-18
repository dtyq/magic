<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use DateTimeImmutable;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WarmPoolSandboxStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\WarmPoolSandboxRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
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
        int $ttlMinutes
    ): WarmPoolSandboxEntity {
        $now = new DateTimeImmutable();
        $entity = new WarmPoolSandboxEntity();
        $entity->setSandboxId($sandboxId);
        $entity->setSandboxName($sandboxName);
        $entity->setAgentImage($agentImage);
        $entity->setStatus(WarmPoolSandboxStatus::Creating->value);
        $entity->setCreatedAt($now->format('Y-m-d H:i:s'));
        $entity->setExpiresAt($now->modify(sprintf('+%d minutes', $ttlMinutes))->format('Y-m-d H:i:s'));
        return $this->repository->insert($entity);
    }

    public function markReady(int $id): void
    {
        $this->repository->markReady($id);
    }

    public function markDead(int $id, string $reason): void
    {
        $this->repository->updateStatus($id, WarmPoolSandboxStatus::Dead->value, $reason);
    }

    public function findBySandboxId(string $sandboxId): ?WarmPoolSandboxEntity
    {
        return $this->repository->findBySandboxId($sandboxId);
    }

    public function countAvailableForImage(string $agentImage): int
    {
        // creating + ready both contribute to "soon-available" headroom so
        // refill doesn't over-shoot while pods are still booting.
        return $this->repository->countByImageAndStatuses($agentImage, [
            WarmPoolSandboxStatus::Creating->value,
            WarmPoolSandboxStatus::Ready->value,
        ]);
    }

    /**
     * Atomically claim a ready sandbox for the given image.
     */
    public function claimOneReady(
        string $agentImage,
        string $userId,
        string $projectId
    ): ?WarmPoolSandboxEntity {
        return $this->repository->claimOneReady(
            $agentImage,
            $userId,
            $projectId,
            date('Y-m-d H:i:s')
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
    public function listStaleImage(string $currentAgentImage, int $limit = 100): array
    {
        return $this->repository->findReadyExcludingImage($currentAgentImage, $limit);
    }

    /**
     * @return WarmPoolSandboxEntity[]
     */
    public function listForImage(string $agentImage, int $limit = 200): array
    {
        return $this->repository->findByImageAndStatuses($agentImage, [
            WarmPoolSandboxStatus::Creating->value,
            WarmPoolSandboxStatus::Ready->value,
        ], $limit);
    }

    public function deleteEntry(int $id): void
    {
        $this->repository->deleteById($id);
    }

    public function lastObservedAgentImage(): ?string
    {
        return $this->repository->findLatestAgentImage();
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
     */
    public function tryAcquireAndMount(
        string $userId,
        string $projectId,
        string $projectSpaceRootFileId,
        string $userSpaceRootFileId,
        string $authorization
    ): ?string {
        $latestImage = $this->gateway->getLatestAgentImage();
        if ($latestImage === '') {
            return null;
        }

        $claimed = $this->claimOneReady($latestImage, $userId, $projectId);
        if ($claimed === null) {
            return null;
        }

        $sandboxId = $claimed->getSandboxId();
        $this->logger->info('[WarmPoolSandbox] Claimed warm-pool sandbox, attempting mount', [
            'sandbox_id' => $sandboxId,
            'user_id' => $userId,
            'project_id' => $projectId,
        ]);

        try {
            $mountResult = $this->gateway->mountWarmPoolSandbox(
                $sandboxId,
                $projectId,
                $projectSpaceRootFileId,
                $userSpaceRootFileId,
                $authorization
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

        $this->logger->info('[WarmPoolSandbox] Mount succeeded, fast path completed', [
            'sandbox_id' => $sandboxId,
        ]);
        return $sandboxId;
    }

    /**
     * Tear down a claimed-but-broken row: mark dead in DB, best-effort
     * delete pod via gateway, then drop the DB entry. Used by
     * {@see tryAcquireAndMount()} after a failed mount.
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
