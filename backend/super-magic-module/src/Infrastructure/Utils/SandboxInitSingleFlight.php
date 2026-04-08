<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Codec\Json;
use Hyperf\Redis\Redis;
use Psr\Log\LoggerInterface;

/**
 * Sandbox initialization SingleFlight coordinator.
 *
 * Ensures that for the same topic, only one request actually executes sandbox initialization,
 * while other concurrent requests wait for and reuse the result.
 *
 * Uses 3 Redis keys per topic:
 * - claim key: short-lived mutex lock for owner election (TTL=10s)
 * - running key: marks that initialization is in progress (TTL=30s, refreshed during execution)
 * - result key: caches the initialization result for reuse (TTL=600s)
 */
class SandboxInitSingleFlight
{
    /**
     * TTL for the result cache (10 minutes).
     */
    private const RESULT_TTL = 600;

    /**
     * TTL for the running marker (30 seconds, refreshed during execution).
     */
    private const RUNNING_TTL = 30;

    /**
     * TTL for the claim lock (10 seconds).
     */
    private const CLAIM_TTL = 10;

    /**
     * Polling interval for follower waiting (seconds).
     */
    private const POLL_INTERVAL = 2;

    /**
     * Maximum wait time for follower (seconds).
     */
    private const MAX_WAIT = 300;

    /**
     * Result status constants.
     */
    private const STATUS_READY = 'ready';

    private const STATUS_FAILED = 'failed';

    public function __construct(
        private readonly Redis $redis,
        private readonly LockerInterface $locker,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Get cached initialization result for a topic.
     *
     * @return null|array{status: string, sandbox_id: string, error: string, time: int}
     */
    public function getResult(int $topicId): ?array
    {
        $data = $this->redis->get($this->getResultKey($topicId));
        if ($data === false || $data === null) {
            return null;
        }
        return Json::decode((string) $data);
    }

    /**
     * Save a successful initialization result.
     */
    public function saveReadyResult(int $topicId, string $sandboxId): void
    {
        $this->redis->setex(
            $this->getResultKey($topicId),
            self::RESULT_TTL,
            Json::encode([
                'status' => self::STATUS_READY,
                'sandbox_id' => $sandboxId,
                'error' => '',
                'time' => time(),
            ])
        );
        $this->logger->info('[SingleFlight] Saved ready result', [
            'topic_id' => $topicId,
            'sandbox_id' => $sandboxId,
        ]);
    }

    /**
     * Save a failed initialization result (short TTL for current batch of followers).
     */
    public function saveFailedResult(int $topicId, string $sandboxId, string $error): void
    {
        $this->redis->setex(
            $this->getResultKey($topicId),
            30, // Short TTL: let current followers see the failure, then expire for retry
            Json::encode([
                'status' => self::STATUS_FAILED,
                'sandbox_id' => $sandboxId,
                'error' => $error,
                'time' => time(),
            ])
        );
        $this->logger->info('[SingleFlight] Saved failed result', [
            'topic_id' => $topicId,
            'sandbox_id' => $sandboxId,
            'error' => $error,
        ]);
    }

    /**
     * Clear cached result for a topic.
     */
    public function clearResult(int $topicId): void
    {
        $this->redis->del($this->getResultKey($topicId));
    }

    /**
     * Check if initialization is currently running for a topic.
     */
    public function isRunning(int $topicId): bool
    {
        return (bool) $this->redis->exists($this->getRunningKey($topicId));
    }

    /**
     * Mark initialization as running (called by owner after claiming).
     */
    public function markRunning(int $topicId, string $requestId): void
    {
        $this->redis->setex($this->getRunningKey($topicId), self::RUNNING_TTL, $requestId);
        $this->logger->info('[SingleFlight] Marked as running', [
            'topic_id' => $topicId,
            'request_id' => $requestId,
        ]);
    }

    /**
     * Refresh the running marker TTL (called at each initialization step to prevent stale detection).
     */
    public function refreshRunning(int $topicId): void
    {
        $this->redis->expire($this->getRunningKey($topicId), self::RUNNING_TTL);
    }

    /**
     * Clear the running marker (called by owner on completion).
     */
    public function clearRunning(int $topicId): void
    {
        $this->redis->del($this->getRunningKey($topicId));
    }

    /**
     * Try to claim owner role for initialization.
     *
     * @return null|string request ID if claimed, null if someone else claimed
     */
    public function tryClaim(int $topicId): ?string
    {
        $requestId = uniqid('sandbox_init_', true);
        $claimKey = $this->getClaimKey($topicId);
        $claimed = $this->locker->mutexLock($claimKey, $requestId, self::CLAIM_TTL);

        if ($claimed) {
            $this->logger->info('[SingleFlight] Claimed owner role', [
                'topic_id' => $topicId,
                'request_id' => $requestId,
            ]);
            return $requestId;
        }

        $this->logger->info('[SingleFlight] Claim failed, another request is owner', [
            'topic_id' => $topicId,
        ]);
        return null;
    }

    /**
     * Release the claim lock (called by owner on completion).
     */
    public function releaseClaim(int $topicId, string $requestId): void
    {
        $this->locker->release($this->getClaimKey($topicId), $requestId);
    }

    /**
     * Wait for initialization result as a follower.
     *
     * @param int $topicId Topic ID
     * @param null|callable $interruptChecker Optional callable, returns true to interrupt
     * @return null|array{status: string, sandbox_id: string, error: string, time: int} result or null if timed out / interrupted
     */
    public function waitForResult(int $topicId, ?callable $interruptChecker = null): ?array
    {
        $startTime = time();

        $this->logger->info('[SingleFlight] Follower waiting for result', [
            'topic_id' => $topicId,
            'max_wait' => self::MAX_WAIT,
        ]);

        while (time() - $startTime < self::MAX_WAIT) {
            if ($interruptChecker !== null && $interruptChecker()) {
                $this->logger->info('[SingleFlight] Follower wait interrupted', [
                    'topic_id' => $topicId,
                    'elapsed' => time() - $startTime,
                ]);
                return null;
            }

            // Check if result is available
            $result = $this->getResult($topicId);
            if ($result !== null) {
                $this->logger->info('[SingleFlight] Follower got result', [
                    'topic_id' => $topicId,
                    'status' => $result['status'],
                    'elapsed' => time() - $startTime,
                ]);
                return $result;
            }

            // Check if owner is still running
            if (! $this->isRunning($topicId)) {
                $this->logger->warning('[SingleFlight] Owner disappeared without result', [
                    'topic_id' => $topicId,
                    'elapsed' => time() - $startTime,
                ]);
                return null; // Owner crashed, caller should retry as new owner
            }

            sleep(self::POLL_INTERVAL);
        }

        $this->logger->error('[SingleFlight] Follower timed out waiting', [
            'topic_id' => $topicId,
            'max_wait' => self::MAX_WAIT,
        ]);
        return null;
    }

    /**
     * Check if a cached result indicates success.
     */
    public function isReady(?array $result): bool
    {
        return $result !== null && ($result['status'] ?? '') === self::STATUS_READY;
    }

    /**
     * Check if a cached result indicates failure.
     */
    public function isFailed(?array $result): bool
    {
        return $result !== null && ($result['status'] ?? '') === self::STATUS_FAILED;
    }

    private function getResultKey(int $topicId): string
    {
        return sprintf('super_agent:sandbox:result:%d', $topicId);
    }

    private function getRunningKey(int $topicId): string
    {
        return sprintf('super_agent:sandbox:running:%d', $topicId);
    }

    private function getClaimKey(int $topicId): string
    {
        return sprintf('super_agent:sandbox:claim:%d', $topicId);
    }
}
