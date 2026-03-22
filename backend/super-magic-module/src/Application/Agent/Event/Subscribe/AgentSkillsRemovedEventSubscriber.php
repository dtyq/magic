<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Event\Subscribe;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Domain\Agent\Event\AgentSkillsRemovedEvent;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class AgentSkillsRemovedEventSubscriber implements ListenerInterface
{
    private const LOCK_KEY_FORMAT = 'agent_skill_file_sync:%s';

    private const LOCK_TIMEOUT = 120;

    private LoggerInterface $logger;

    public function __construct(
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly SkillRepositoryInterface $skillRepository,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            AgentSkillsRemovedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof AgentSkillsRemovedEvent) {
            return;
        }

        Coroutine::create(function () use ($event) {
            $this->handleEvent($event);
        });
    }

    private function handleEvent(AgentSkillsRemovedEvent $event): void
    {
        $agentCode = $event->getAgentCode();
        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $agentCode);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->mutexLock($lockKey, $lockOwner, self::LOCK_TIMEOUT)) {
            $this->logger->info('Skip agent skill file removal due to lock contention', [
                'agent_code' => $agentCode,
            ]);
            return;
        }

        try {
            $this->removeSkillFiles($event);
        } catch (Throwable $e) {
            $this->logger->error('Agent skill file removal failed', [
                'agent_code' => $agentCode,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    private function removeSkillFiles(AgentSkillsRemovedEvent $event): void
    {
        $dataIsolation = $event->getDataIsolation();
        $agentCode = $event->getAgentCode();
        $skillCodes = $event->getSkillCodes();
        $organizationCode = $event->getOrganizationCode();

        $agentEntity = $this->superMagicAgentDomainService->getByCode($dataIsolation, $agentCode);
        if ($agentEntity === null) {
            $this->logger->warning('Agent not found for skill file removal', ['agent_code' => $agentCode]);
            return;
        }

        $projectId = $agentEntity->getProjectId();
        if ($projectId === null || $projectId <= 0) {
            $this->logger->info('Agent has no project, skip skill file removal', ['agent_code' => $agentCode]);
            return;
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($projectEntity === null) {
            $this->logger->warning('Project not found for skill file removal', ['project_id' => $projectId]);
            return;
        }

        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            $this->logger->warning('Project workDir is empty', ['project_id' => $projectId]);
            return;
        }

        $projectOrgCode = $projectEntity->getUserOrganizationCode();
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectOrgCode);

        $skillsDirFileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, 'skills');
        $skillsDirFileKey = ltrim($skillsDirFileKey, '/') . '/';

        $userId = $dataIsolation->getCurrentUserId();
        $contactDataIsolation = DataIsolation::simpleMake($organizationCode, $userId);
        $skillDataIsolation = SkillDataIsolation::create($organizationCode, $userId);
        $skillDataIsolation->disabled();

        foreach ($skillCodes as $skillCode) {
            try {
                $skillEntity = $this->skillRepository->findByCode($skillDataIsolation, $skillCode);
                if ($skillEntity === null) {
                    $this->logger->warning('Skill not found for removal', ['skill_code' => $skillCode]);
                    continue;
                }

                $packageName = $skillEntity->getPackageName();
                if (empty($packageName)) {
                    $this->logger->warning('Skill packageName is empty for removal', ['skill_code' => $skillCode]);
                    continue;
                }

                $targetPath = $skillsDirFileKey . $packageName . '/';

                $this->taskFileDomainService->deleteDirectoryFiles(
                    $contactDataIsolation,
                    $workDir,
                    $projectId,
                    $targetPath,
                    $projectOrgCode
                );

                $this->logger->info('Skill files removed', [
                    'skill_code' => $skillCode,
                    'package_name' => $packageName,
                    'target_path' => $targetPath,
                ]);
            } catch (Throwable $e) {
                $this->logger->error('Failed to remove skill files', [
                    'skill_code' => $skillCode,
                    'agent_code' => $agentCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->logger->info('Agent skill file removal completed', [
            'agent_code' => $agentCode,
            'skill_codes' => $skillCodes,
            'project_id' => $projectId,
        ]);
    }
}
