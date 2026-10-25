<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Domain\SuperMagic\Agent\Event\ClawPermissionReconciliationRequestedEvent;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawReconciliationRepository;
use App\Domain\SuperMagic\Agent\Service\MagicClawRuntimePolicyDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\SuperMagic\Task\Locker\SandboxLifecycleLock;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\DbConnection\Db;
use RuntimeException;
use Throwable;

class MagicClawReconciliationAppService
{
    use HasLogger;

    public function __construct(
        private readonly MagicClawReconciliationRepository $repository,
        private readonly MagicClawRuntimePolicyDomainService $policy,
        private readonly AgentDomainService $agent,
        private readonly TaskDomainService $tasks,
        private readonly SandboxLifecycleLock $lifecycle,
        private readonly LockerInterface $locker,
    ) {
    }

    public function status(string $organization): ?array
    {
        $operation = $this->repository->latest($organization);
        return $operation === null ? null : $this->repository->summarize($operation);
    }

    /** Read-only inventory for an explicitly selected organization; never infer sandbox IDs. */
    public function preview(string $organization): iterable
    {
        $cursor = 0;
        do {
            $rows = $this->repository->claws($organization, $cursor);
            foreach ($rows as $claw) {
                $cursor = (int) $claw['id'];
                if (empty($claw['deleted_at']) && $this->policy->isAllowed($organization, $claw['user_id'])) {
                    continue;
                }
                $resources = 0;
                foreach ($this->repository->topics($claw) as $topic) {
                    ++$resources;
                    yield ['claw_id' => (string) $claw['id'], 'user_id' => $claw['user_id'], 'topic_id' => (string) $topic['id'], 'sandbox_id' => (string) ($topic['sandbox_id'] ?? '')];
                }
                $converter = $this->repository->converterSandbox((int) $claw['id']);
                if ($resources === 0 || $converter !== '') {
                    yield ['claw_id' => (string) $claw['id'], 'user_id' => $claw['user_id'], 'topic_id' => '0', 'sandbox_id' => $converter];
                }
            }
        } while (count($rows) === 100);
    }

    public function retry(string $organization, string $operationId): array
    {
        $result = $this->withOrganizationLock($organization, function () use ($organization, $operationId): array {
            $operation = $this->repository->latest($organization);
            if ($operation === null || (string) $operation['id'] !== $operationId) {
                ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'permission.magic_claw_reconciliation_stale');
            }
            if ($operation['status'] !== 'completed') {
                $this->repository->retry($operation);
            }
            return $this->status($organization) ?? [];
        });
        $this->notify($organization);
        return $result;
    }

    public function execute(): void
    {
        // Recovery only: no sandbox I/O or scans inside the periodic scheduler.
        foreach ($this->repository->activeOperations(5) as $operation) {
            $this->notify($operation['organization_code']);
        }
    }

    /** Process one small batch. True requests a paced continuation, not a polling loop. */
    public function executeForOrganization(string $organization, int $itemLimit = 5): bool
    {
        $operation = $this->repository->latest($organization);
        if ($operation === null || ! in_array($operation['status'], ['pending', 'running', 'partial_failed'], true)
            || ! $this->repository->hasDueWork($operation)) {
            return false;
        }
        $owner = bin2hex(random_bytes(16));
        $slot = null;
        // At most two background batches across the deployment; occupied slots do not spin.
        for ($index = 0; $index < 2; ++$index) {
            $name = 'claw_permission_worker:' . $index;
            if ($this->locker->mutexLock($name, $owner, 600)) {
                $slot = $name;
                break;
            }
        }
        if ($slot === null) {
            return false;
        }
        $claimed = false;
        try {
            $claimed = $this->repository->claim($operation, $owner);
            if (! $claimed) {
                return false;
            }
            $deadline = microtime(true) + 20;
            $this->scan($operation, $deadline);
            for ($processed = 0; $processed < max(1, min($itemLimit, 20)); ++$processed) {
                if (microtime(true) >= $deadline || ! $this->repository->isCurrent($operation)
                    || ! ($item = $this->repository->dueItem($operation))) {
                    break;
                }
                if (! $this->repository->renew($operation, $owner)) {
                    return false;
                }
                $this->stopItem($operation, $item);
            }
            $fresh = $this->repository->latest($organization);
            if ($fresh !== null && (string) $fresh['id'] === (string) $operation['id']) {
                $this->repository->updateOperation($fresh, ['status' => $this->repository->summarize($fresh)['status']]);
                return $this->repository->hasDueWork($fresh);
            }
            return false;
        } catch (Throwable $exception) {
            $this->logger->error('龙虾权限停机处理失败', ['operation_id' => (string) $operation['id'], 'exception' => $exception->getMessage()]);
            throw $exception;
        } finally {
            try {
                if ($claimed) {
                    $this->repository->release($operation, $owner);
                }
            } finally {
                $this->locker->release($slot, $owner);
            }
        }
    }

    public function requestReconciliation(string $organization, string $reason, bool $force = false, bool $notify = true, string $actor = ''): void
    {
        $this->withOrganizationLock($organization, function () use ($organization, $reason, $force, $actor): void {
            $latest = $this->repository->latest($organization);
            if (! $force && $latest !== null && in_array($latest['status'], ['pending', 'running', 'partial_failed'], true)) {
                return;
            }
            Db::transaction(fn () => $this->repository->create($organization, $actor, $reason));
        });
        if ($notify) {
            $this->notify($organization);
        }
    }

    private function notify(string $organization): void
    {
        AsyncEventUtil::dispatch(new ClawPermissionReconciliationRequestedEvent($organization));
    }

    private function scan(array $operation, float $deadline): void
    {
        if ($operation['scan_completed'] || ! $this->repository->isCurrent($operation)) {
            return;
        }
        $claws = $this->repository->claws($operation['organization_code'], (int) $operation['cursor'], 10);
        foreach ($claws as $claw) {
            if (! empty($claw['deleted_at']) || ! $this->policy->isAllowed($claw['organization_code'], $claw['user_id'])) {
                $topics = $this->repository->topicPage($claw, $this->repository->scannedTopicCursor($operation, $claw));
                foreach ($topics as $topic) {
                    $this->repository->enqueue($operation, $claw, $topic);
                }
                if (count($topics) === 25) {
                    // Keep the claw cursor here; persisted items supply the next topic page cursor.
                    return;
                }
                // The auxiliary resource also represents claws with no topic yet.
                $this->repository->enqueue($operation, $claw, ['id' => 0, 'sandbox_id' => $this->repository->converterSandbox((int) $claw['id'])]);
            }
            $this->repository->updateOperation($operation, ['cursor' => $claw['id']]);
            if (microtime(true) >= $deadline) {
                return;
            }
        }
        if (count($claws) < 10) {
            $this->repository->updateOperation($operation, ['scan_completed' => true]);
        }
    }

    private function stopItem(array $operation, array $item): void
    {
        try {
            $resource = $this->repository->claw((int) $item['claw_id']);
            if ($resource === null) {
                throw new RuntimeException('resource_identity_mismatch');
            }
            $lockId = (int) $item['topic_id'] ?: -((int) $resource['project_id']);
            $this->lifecycle->run($lockId, function (callable $assertOwnership) use ($operation, $item): void {
                $assertOwnership();
                if (! $this->repository->isCurrent($operation)) {
                    return;
                }
                $claw = $this->repository->claw((int) $item['claw_id']);
                $topic = (int) $item['topic_id'] > 0 ? $this->repository->topic((int) $item['topic_id']) : null;
                if ($claw === null || $claw['organization_code'] !== $operation['organization_code']
                    || ((int) $item['topic_id'] > 0 && ($topic === null
                        || $topic['user_organization_code'] !== $claw['organization_code']
                        || $topic['user_id'] !== $claw['user_id'] || (string) $topic['project_id'] !== (string) $claw['project_id']))) {
                    throw new RuntimeException('resource_identity_mismatch');
                }
                $shouldStop = $this->withOrganizationLock($claw['organization_code'], function () use ($operation, $item, $claw): bool {
                    if (! $this->repository->isCurrent($operation)) {
                        return false;
                    }
                    if (empty($claw['deleted_at']) && $this->policy->isAllowed($claw['organization_code'], $claw['user_id'])) {
                        $this->repository->updateItem($item, ['status' => 'skipped', 'last_error' => '']);
                        return false;
                    }
                    $this->repository->requireManualStart($item);
                    return true;
                });
                if (! $shouldStop) {
                    return;
                }
                // Cancel queued work even when stopping the pod times out, so it cannot replay after reauthorization.
                if ($topic !== null) {
                    $this->repository->cancelQueuedMessages($topic, ! empty($claw['deleted_at']) ? 'Magic Claw deleted' : 'Magic Claw access revoked');
                }
                // Resolve again under the initialization lock; never delete an ID guessed from topic_id.
                $sandboxId = (string) ($topic !== null ? ($topic['sandbox_id'] ?? '') : ($this->repository->converterSandbox((int) $claw['id'])));
                $this->repository->updateItem($item, ['sandbox_id' => $sandboxId]);
                $assertOwnership();
                if ($sandboxId !== '') {
                    $this->agent->stopSandboxIfExists($sandboxId);
                }
                $assertOwnership();
                if ($topic !== null) {
                    $this->tasks->updateTaskStatusByTopicIds([(int) $topic['id']], TaskStatus::Stopped, ! empty($claw['deleted_at']) ? 'Magic Claw deleted' : 'Magic Claw access revoked', [TaskStatus::WAITING, TaskStatus::RUNNING, TaskStatus::WAITING_FOR_USER]);
                    $this->repository->clearBinding((int) $topic['id'], $sandboxId);
                } else {
                    $this->repository->clearConverter((int) $claw['id'], $sandboxId);
                }
                $this->repository->updateItem($item, ['status' => 'stopped', 'last_error' => '']);
            }, 0);
        } catch (Throwable $exception) {
            $attempts = (int) $item['attempts'] + 1;
            $delay = [300, 600, 1800][min($attempts - 1, 2)];
            $this->repository->updateItem($item, [
                'status' => 'failed', 'attempts' => $attempts, 'next_retry_at' => time() + ($attempts > 3 ? 3600 : $delay),
                // Do not return provider URLs, tokens or raw exception messages to administrators.
                'last_error' => 'sandbox_stop_unconfirmed',
            ]);
            $this->logger->warning('龙虾沙箱停止未确认，将重试', ['operation_id' => (string) $operation['id'], 'topic_id' => (string) $item['topic_id'], 'exception' => $exception->getMessage()]);
        }
    }

    private function withOrganizationLock(string $organization, callable $callback): mixed
    {
        $name = 'claw_permission_policy:' . $organization;
        $owner = bin2hex(random_bytes(16));
        if (! $this->locker->spinLock($name, $owner, 60, 10)) {
            ExceptionBuilder::throw(PermissionErrorCode::BusinessException, 'permission.magic_claw_reconciliation_busy');
        }
        try {
            return $callback();
        } finally {
            $this->locker->release($name, $owner);
        }
    }
}
