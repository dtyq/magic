<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Service;

use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\FunctionPermissionDomainService;
use App\Domain\SuperMagic\Agent\Entity\MagicClawEntity;
use App\Domain\SuperMagic\Agent\Exception\MagicClawRuntimeDeniedException;
use App\Domain\SuperMagic\Agent\Repository\Facade\MagicClawRepositoryInterface;
use App\Domain\SuperMagic\Agent\Repository\Persistence\MagicClawReconciliationRepository;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Topic\Repository\Facade\TopicRepositoryInterface;
use Hyperf\Context\Context;
use Hyperf\Coroutine\Coroutine;

class MagicClawRuntimePolicyDomainService
{
    public const ACCESS = 'magic_claw.access';

    public function __construct(
        private readonly FunctionPermissionDomainService $permissions,
        private readonly MagicClawRepositoryInterface $claws,
        private readonly ProjectRepositoryInterface $projects,
        private readonly TopicRepositoryInterface $topics,
        private readonly TaskRepositoryInterface $tasks,
        private readonly MagicClawReconciliationRepository $reconciliations,
    ) {
    }

    public function isAllowed(string $organization, string $userId): bool
    {
        return $this->permissions->checkPermission(PermissionDataIsolation::create($organization, $userId), $userId, self::ACCESS, true);
    }

    public function assertCanCreate(string $organization, string $userId): void
    {
        if (! $this->isAllowed($organization, $userId)
            || ! $this->permissions->checkPermission(PermissionDataIsolation::create($organization, $userId), $userId, 'magic_claw.create')) {
            throw new MagicClawRuntimeDeniedException();
        }
    }

    public function assertTopic(int $topicId, bool $manualStart = false): ?MagicClawEntity
    {
        $topic = $this->topics->getTopicById($topicId);
        if ($topic === null) {
            throw new MagicClawRuntimeDeniedException();
        }
        return $this->assertProject($topic->getProjectId(), $manualStart);
    }

    public function assertProject(int $projectId, bool $manualStart = false): ?MagicClawEntity
    {
        $project = $this->projects->findById($projectId);
        if ($project === null) {
            throw new MagicClawRuntimeDeniedException();
        }
        $manualStart = $manualStart || Context::get($this->manualContextKey($projectId), false);
        if ($project->getProjectMode() !== ProjectMode::MAGICLAW->value) {
            return null;
        }
        $claw = $this->claws->getByProjectId($projectId);
        if ($claw === null || $claw->getOrganizationCode() !== $project->getUserOrganizationCode()
            || ! $this->isAllowed($claw->getOrganizationCode(), $claw->getUserId())
            || (! $manualStart && $this->requiresManualStart($claw))) {
            throw new MagicClawRuntimeDeniedException();
        }
        return $claw;
    }

    public function requiresManualStart(MagicClawEntity $claw): bool
    {
        return $this->reconciliations->pauseRevision((int) $claw->getId()) !== '0';
    }

    /** Resolve IDs against server-side records; client-supplied mode/owner never decides permission. */
    public function assertModelInvocation(ModelGatewayDataIsolation $isolation, array $params): void
    {
        $topicId = (string) ($params['magic_topic_id'] ?? $params['topic_id'] ?? '');
        $taskId = (string) ($params['magic_task_id'] ?? '');
        if ($taskId !== '') {
            $task = ctype_digit($taskId) ? $this->tasks->getTaskById((int) $taskId) : null;
            if ($task === null || ($topicId !== '' && $topicId !== (string) $task->getTopicId())) {
                throw new MagicClawRuntimeDeniedException();
            }
            $topicId = (string) $task->getTopicId();
        }
        if ($topicId === '') {
            // Ordinary API/chat requests do not own a Super Magic topic.
            if (in_array($params['source_id'] ?? '', ['super_magic', 'magiclaw'], true)) {
                throw new MagicClawRuntimeDeniedException();
            }
            return;
        }
        $topic = ctype_digit($topicId) ? $this->topics->getTopicById((int) $topicId) : null;
        if ($topic === null || $topic->getUserOrganizationCode() !== $isolation->getCurrentOrganizationCode()) {
            throw new MagicClawRuntimeDeniedException();
        }
        $claw = $this->assertProject($topic->getProjectId());
        if ($claw !== null && $claw->getUserId() !== $isolation->getCurrentUserId()) {
            throw new MagicClawRuntimeDeniedException();
        }
    }

    /** Only explicit user starts may clear a persistent pause. */
    public function manualStart(int $topicId, callable $operation): mixed
    {
        $claw = $this->assertTopic($topicId, true);
        if ($claw === null) {
            return $operation();
        }
        $projectId = (int) $claw->getProjectId();
        $revision = $this->reconciliations->pauseRevision((int) $claw->getId());
        $key = $this->manualContextKey($projectId);
        Context::set($key, true);
        try {
            $result = $operation();
            $this->completeManualStart($projectId, $revision);
            return $result;
        } finally {
            Context::destroy($key);
        }
    }

    public function completeManualStart(int $projectId, string $expectedRevision): void
    {
        $claw = $this->assertProject($projectId, true);
        if ($claw !== null) {
            // Do not erase a newer revocation recorded during initialization.
            if (! $this->reconciliations->resumeAfterStart((int) $claw->getId(), $expectedRevision)) {
                throw new MagicClawRuntimeDeniedException();
            }
        }
    }

    private function manualContextKey(int $projectId): string
    {
        return 'claw_manual_start:' . $projectId . ':' . Coroutine::id();
    }
}
