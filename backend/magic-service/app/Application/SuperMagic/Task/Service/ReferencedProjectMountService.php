<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\Service;

use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use App\Infrastructure\Util\Locker\LockerInterface;
use RuntimeException;
use Throwable;

/**
 * Reconcile the sandbox namespace before each task, including tasks with no mentions.
 * Publication never grants collaboration identity or write access.
 */
class ReferencedProjectMountService
{
    private const PREPARATION_TIMEOUT_SECONDS = 3000;

    private const LOCK_EXPIRE_SECONDS = 3600;

    private const LOCK_WAIT_SLICE_SECONDS = 1;

    public function __construct(
        private readonly SandboxGatewayInterface $gateway,
        private readonly ReferencedProjectCollaborationAccess $collaborationAccess,
        private readonly PublishedMicroAppFileAccessService $publishedFileAccess,
        private readonly ReferencedProjectMountGuard $guard,
        private readonly TaskFileDomainService $files,
        private readonly AgentDomainService $agent,
        private readonly LockerInterface $locker,
    ) {
    }

    /**
     * @param list<ReferencedProjectMount> $mounts
     * @param callable(): bool $isTerminated
     * @param callable(): void $send
     */
    public function prepareAndSend(
        DataIsolation $identity,
        string $sandboxId,
        array $mounts,
        callable $isTerminated,
        callable $send,
    ): void {
        $lockName = 'referenced-projects:' . $sandboxId;
        $owner = bin2hex(random_bytes(16));
        if (! $this->acquirePreparationLock($lockName, $owner, $isTerminated)) {
            return;
        }
        $deadline = hrtime(true) + self::PREPARATION_TIMEOUT_SECONDS * 1_000_000_000;
        $checkDeadline = static function () use ($deadline): void {
            if (hrtime(true) >= $deadline) {
                throw new RuntimeException('Sandbox reference preparation timed out');
            }
        };
        try {
            if ($this->terminated($isTerminated)) {
                return;
            }
            // This authenticated endpoint checks the current token against metadata.json.
            // A mount request's authorization payload does not change AGFS identity.
            if (! $this->agent->getWorkspaceStatus($identity, $sandboxId)->isSuccess()) {
                throw new RuntimeException('Cannot verify sandbox file access identity');
            }
            $existing = $this->listProjects($identity, $sandboxId);
            $retained = [];
            $refresh = [];
            foreach ($existing as $projectId) {
                $checkDeadline();
                if ($this->canCollaborate($identity, $projectId)) {
                    $retained[$projectId] = true;
                    continue;
                }
                // Drop publication-only mounts even when still authorized: AGFS caches
                // are project-scoped and may have been populated under broader access.
                $checkDeadline();
                $this->unmount($identity, $sandboxId, $projectId);
                if ($this->publishedFileAccess->canAccessProject(
                    (int) $projectId,
                    $identity->getCurrentUserId(),
                    $identity->getCurrentOrganizationCode(),
                )) {
                    $refresh[$projectId] = true;
                }
            }
            $actual = $this->listProjects($identity, $sandboxId);
            if (array_diff($actual, array_keys($retained)) !== []) {
                throw new RuntimeException('Cannot confirm revoked references were removed');
            }
            // References may disappear during sandbox recovery; remount requested ones.
            $retained = array_fill_keys($actual, true);
            $this->guard->assertAllAccessible($mounts, $identity, function (int $projectId) use ($identity): void {
                if (! $this->canCollaborate($identity, (string) $projectId)) {
                    throw new RuntimeException('Referenced project access denied');
                }
            });
            foreach ($mounts as $mount) {
                if (! isset($retained[$mount->projectId])) {
                    $refresh[$mount->projectId] = true;
                }
            }
            $attempted = [];
            try {
                foreach (array_keys($refresh) as $projectId) {
                    $checkDeadline();
                    if ($this->terminated($isTerminated)) {
                        break;
                    }
                    $projectId = (string) $projectId;
                    $rootId = $this->files->getProjectRootFileId((int) $projectId);
                    if ($rootId <= 0) {
                        throw new RuntimeException('Referenced project root is unavailable');
                    }
                    $root = (string) $rootId;
                    $checkDeadline();
                    // A timed-out request may still have created the mount.
                    $attempted[] = $projectId;
                    if (! $this->gateway->mountReferencedProject($identity, $sandboxId, $projectId, $root)->isSuccess()) {
                        throw new RuntimeException('Cannot mount referenced project ' . $projectId);
                    }
                }
                $checkDeadline();
            } catch (Throwable $error) {
                $this->cleanup($identity, $sandboxId, $attempted, $deadline);
                throw $error;
            }
            if ($this->terminated($isTerminated)) {
                $this->cleanup($identity, $sandboxId, $attempted, $deadline);
                return;
            }
            // Delivery failures are ambiguous: the agent may already be running.
            // Keep its references and reconcile them at the next task boundary.
            $send();
        } finally {
            $this->locker->release($lockName, $owner);
        }
    }

    /** @param callable(): bool $isTerminated */
    private function acquirePreparationLock(string $lockName, string $owner, callable $isTerminated): bool
    {
        // Reserve time beyond the preparation deadline for bounded gateway calls/cleanup.
        if ($this->locker->mutexLock($lockName, $owner, self::LOCK_EXPIRE_SECONDS)) {
            return true;
        }

        // 启动时插入的消息等待前一次准备和发送；分段等待让终止可被检测。
        // 等待独立计时，取得锁后仍保留完整的准备预算。
        $deadline = hrtime(true) + self::PREPARATION_TIMEOUT_SECONDS * 1_000_000_000;
        while (true) {
            if ($this->terminated($isTerminated)) {
                return false;
            }
            if (hrtime(true) >= $deadline) {
                throw new RuntimeException('Sandbox reference preparation lock wait timed out');
            }
            if ($this->locker->spinLock($lockName, $owner, self::LOCK_EXPIRE_SECONDS, self::LOCK_WAIT_SLICE_SECONDS)) {
                return true;
            }
        }
    }

    /**
     * 每次都重新询问终止状态。
     * 重复直接调用同一个 callable 时，静态分析会沿用第一次的结果。
     *
     * @param callable(): bool $isTerminated
     */
    private function terminated(callable $isTerminated): bool
    {
        return $isTerminated();
    }

    private function canCollaborate(DataIsolation $identity, string $projectId): bool
    {
        return $this->collaborationAccess->canAccess(
            (int) $projectId,
            $identity->getCurrentUserId(),
            $identity->getCurrentOrganizationCode(),
        );
    }

    /** @return list<string> */
    private function listProjects(DataIsolation $identity, string $sandboxId): array
    {
        $result = $this->gateway->listReferencedProjects($identity, $sandboxId);
        $rows = $result->getDataValue('referenced_projects');
        if (! $result->isSuccess() || ! is_array($rows) || ! array_is_list($rows)) {
            throw new RuntimeException('Cannot list sandbox references');
        }
        $ids = [];
        foreach ($rows as $row) {
            $id = is_array($row) ? ($row['project_id'] ?? null) : null;
            if ((! is_string($id) && ! is_int($id))
                || ! preg_match('/^[1-9][0-9]*$/D', (string) $id)
                || (string) (int) $id !== (string) $id) {
                throw new RuntimeException('Invalid sandbox reference list');
            }
            $ids[] = (string) $id;
        }
        return array_values(array_unique($ids));
    }

    private function unmount(DataIsolation $identity, string $sandboxId, string $projectId): void
    {
        if (! $this->gateway->unmountReferencedProject($identity, $sandboxId, $projectId)->isSuccess()) {
            throw new RuntimeException('Cannot remove referenced project ' . $projectId);
        }
    }

    private function cleanup(DataIsolation $identity, string $sandboxId, array $attempted, int $deadline): void
    {
        if ($attempted === []) {
            return;
        }
        // Re-list also handles a mount request that failed after server-side creation.
        $checkCleanupDeadline = static function () use ($deadline): void {
            if (hrtime(true) >= $deadline + 500 * 1_000_000_000) {
                throw new RuntimeException('Sandbox reference cleanup timed out');
            }
        };
        $checkCleanupDeadline();
        $present = $this->listProjects($identity, $sandboxId);
        foreach (array_intersect($attempted, $present) as $projectId) {
            $checkCleanupDeadline();
            $this->unmount($identity, $sandboxId, $projectId);
        }
        $checkCleanupDeadline();
        if (array_intersect($attempted, $this->listProjects($identity, $sandboxId)) !== []) {
            throw new RuntimeException('Cannot confirm failed reference preparation was cleaned up');
        }
    }
}
