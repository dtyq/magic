<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Event\Subscribe;

use App\Application\SuperMagic\Agent\Service\SkillsMdSyncService;
use App\Domain\SuperMagic\Agent\Event\AgentSkillsAddedEvent;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentDomainService;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class AgentSkillsAddedEventSubscriber implements ListenerInterface
{
    private const LOCK_KEY_FORMAT = 'agent_skill_file_sync:%s';

    private const LOCK_TIMEOUT = 120;

    private LoggerInterface $logger;

    public function __construct(
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly LockerInterface $locker,
        private readonly SkillsMdSyncService $skillsMdSyncService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            AgentSkillsAddedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof AgentSkillsAddedEvent) {
            return;
        }

        Coroutine::create(function () use ($event) {
            $this->handleEvent($event);
        });
    }

    private function handleEvent(AgentSkillsAddedEvent $event): void
    {
        $agentCode = $event->getAgentCode();
        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $agentCode);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->mutexLock($lockKey, $lockOwner, self::LOCK_TIMEOUT)) {
            $this->logger->info('Skip agent skill file sync due to lock contention', [
                'agent_code' => $agentCode,
            ]);
            return;
        }

        try {
            $this->syncSkillFiles($event);
        } catch (Throwable $e) {
            $this->logger->error('Agent skill file sync failed', [
                'agent_code' => $agentCode,
                'error' => $e->getMessage(),
            ]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    private function syncSkillFiles(AgentSkillsAddedEvent $event): void
    {
        $dataIsolation = $event->getDataIsolation();
        $agentCode = $event->getAgentCode();
        $organizationCode = $event->getOrganizationCode();

        $agentEntity = $this->superMagicAgentDomainService->getByCode($dataIsolation, $agentCode);
        if ($agentEntity === null) {
            $this->logger->warning('Agent not found for skill file sync', ['agent_code' => $agentCode]);
            return;
        }

        $projectId = $agentEntity->getProjectId();
        if ($projectId === null || $projectId <= 0) {
            $this->logger->info('Agent has no project, skip skill file sync', ['agent_code' => $agentCode]);
            return;
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($projectEntity === null) {
            $this->logger->warning('Project not found for skill file sync', ['project_id' => $projectId]);
            return;
        }

        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            $this->logger->warning('Project workDir is empty', ['project_id' => $projectId]);
            return;
        }

        $userId = $dataIsolation->getCurrentUserId();
        $projectOrgCode = $projectEntity->getUserOrganizationCode();

        $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            $projectId,
            $workDir,
            $userId,
            $organizationCode,
            $projectOrgCode,
            TaskFileSource::SKILL
        );

        $this->taskFileDomainService->createDirectory(
            $projectId,
            $rootDirId,
            '.magic',
            $userId,
            $organizationCode,
            $projectOrgCode,
            TaskFileSource::SKILL
        );

        // Rebuild from current bindings: delayed add events must not restore removed references.
        $bound = $this->skillsMdSyncService->getBoundSkills($dataIsolation, $agentCode, strict: false);
        $this->skillsMdSyncService->syncSkillsMd(
            $projectId,
            $projectEntity,
            $organizationCode,
            $projectOrgCode,
            [],
            SkillsMdSyncService::OPERATION_SYNC,
            $bound['system_skills'],
            $bound['market_skills'],
            false
        );
    }
}
