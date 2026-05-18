<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WarmPoolSandboxEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WarmPoolSandboxDomainService;
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
        $latestImage = $this->gateway->getLatestAgentImage();
        if ($latestImage === '') {
            $this->logger->warning('[WarmPoolSandbox] Refill skipped: unable to resolve latest agent image');
            return ['skipped' => 'no_latest_image', 'created' => 0];
        }

        $available = $this->domain->countAvailableForImage($latestImage);
        $deficit = max(0, $targetSize - $available);
        $burst = min($deficit, self::REFILL_BURST);
        $created = 0;
        $errors = [];

        for ($i = 0; $i < $burst; ++$i) {
            $result = $this->gateway->createWarmPoolSandbox();
            if (! $result->isSuccess()) {
                $errors[] = $result->getMessage();
                $this->logger->error('[WarmPoolSandbox] createWarmPoolSandbox failed', [
                    'code' => $result->getCode(),
                    'message' => $result->getMessage(),
                ]);
                continue;
            }
            $sandboxId = (string) ($result->getDataValue('sandbox_id') ?? '');
            $sandboxName = (string) ($result->getDataValue('sandbox_name') ?? '');
            $image = (string) ($result->getDataValue('agent_image') ?? $latestImage);

            if ($sandboxId === '') {
                $errors[] = 'empty_sandbox_id';
                continue;
            }

            try {
                // sandbox-gateway returns once the agfs-server inside the pod
                // is responsive, so we can fast-forward straight to ready.
                $entity = $this->domain->recordCreating($sandboxId, $sandboxName, $image, self::POOL_TTL_MINUTES);
                if ($entity->getId() !== null) {
                    $this->domain->markReady($entity->getId());
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
            'available_before' => $available,
            'target' => $targetSize,
            'created' => $created,
            'errors' => $errors,
        ]);

        return [
            'image' => $latestImage,
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
     * Drop all warm-pool sandboxes whose agent_image does not match the
     * current generation; used when sandbox-gateway rolls out a new agent
     * image.
     */
    public function invalidateStaleImageGeneration(string $currentImage): array
    {
        if ($currentImage === '') {
            return ['deleted' => 0, 'skipped' => 'no_current_image'];
        }
        $rows = $this->domain->listStaleImage($currentImage, 200);
        $deleted = 0;
        foreach ($rows as $row) {
            if ($this->forceDelete($row, 'stale_image:' . $currentImage)) {
                ++$deleted;
            }
        }
        if ($deleted > 0) {
            $this->logger->info('[WarmPoolSandbox] Invalidated stale-image warm-pool sandboxes', [
                'current_image' => $currentImage,
                'deleted' => $deleted,
            ]);
        }
        return ['deleted' => $deleted, 'current_image' => $currentImage];
    }

    /**
     * Detect whether the gateway has rolled to a new agent image generation
     * since we last persisted a warm-pool row. Returns the previous image
     * or null when no shift has occurred.
     */
    public function detectImageGenerationShift(): ?string
    {
        $latest = $this->gateway->getLatestAgentImage();
        if ($latest === '') {
            return null;
        }
        $previous = $this->domain->lastObservedAgentImage();
        if ($previous === null || $previous === $latest) {
            return null;
        }
        return $previous;
    }

    public static function gatewayResultMessage(GatewayResult $result): string
    {
        return $result->getMessage();
    }

    private function forceDelete(WarmPoolSandboxEntity $row, string $reason): bool
    {
        // First try to delete the pod via gateway, then remove the row.
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

        if ($row->getId() === null) {
            return false;
        }
        $this->domain->deleteEntry($row->getId());
        return true;
    }
}
