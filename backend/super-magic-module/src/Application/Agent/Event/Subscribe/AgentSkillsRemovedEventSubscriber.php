<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\SuperMagic\Application\Agent\Service\SkillsMdSyncService;
use Dtyq\SuperMagic\Domain\Agent\Event\AgentSkillsRemovedEvent;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
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
        private readonly MagicUserRepository $magicUserRepository,
        private readonly LockerInterface $locker,
        private readonly SkillsMdSyncService $skillsMdSyncService,
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
        $userId = $dataIsolation->getCurrentUserId();

        // Locate the skills directory via tree navigation (parent_id + file_name).
        // Standard structure: root -> .magic -> skills.
        // Legacy fallback: root -> skills (old data written before the .magic layout).
        $magicDirEntity = $this->taskFileDomainService->findDirectoryByPath($projectId, '.magic');
        $skillsDirEntity = $magicDirEntity !== null
            ? $this->taskFileDomainService->findChildDirectoryByName($projectId, $magicDirEntity->getFileId(), 'skills')
            : null;

        if ($skillsDirEntity === null) {
            // Legacy fallback: try skills directly under root.
            $skillsDirEntity = $this->taskFileDomainService->findDirectoryByPath($projectId, 'skills');
        }

        $skillDataIsolation = SkillDataIsolation::create($organizationCode, $userId);
        $skillDataIsolation->disabled();

        $allDeletedFileIds = [];
        $removedPackageNames = [];

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

                $removedPackageNames[] = $packageName;

                if ($skillsDirEntity === null) {
                    $this->logger->info('Skills directory not found, skipping file removal for skill', [
                        'skill_code' => $skillCode,
                        'package_name' => $packageName,
                    ]);
                    continue;
                }

                // Find the package directory as a direct child of the skills directory.
                // Uses parent_id + file_name lookup; no path string construction needed.
                $packageDirEntity = $this->taskFileDomainService->findChildDirectoryByName(
                    $projectId,
                    $skillsDirEntity->getFileId(),
                    $packageName
                );

                if ($packageDirEntity === null) {
                    $this->logger->info('Package directory not found, nothing to remove', [
                        'skill_code' => $skillCode,
                        'package_name' => $packageName,
                    ]);
                    continue;
                }

                // Collect all descendant file IDs for the push notification.
                $descendants = $this->taskFileDomainService->findFilesRecursivelyByParentId(
                    $projectId,
                    $packageDirEntity->getFileId()
                );
                $descendantIds = array_map(fn ($entity) => $entity->getFileId(), $descendants);
                $allDeletedFileIds = array_merge($allDeletedFileIds, $descendantIds, [$packageDirEntity->getFileId()]);

                // Delete all descendants, then delete the package directory node itself.
                $this->taskFileDomainService->clearProjectFile($projectId, $projectOrgCode, $packageDirEntity->getFileId());
                $this->taskFileDomainService->deleteProjectFiles($projectOrgCode, $packageDirEntity, $workDir);

                $this->logger->info('Skill files removed', [
                    'skill_code' => $skillCode,
                    'package_name' => $packageName,
                    'files_deleted' => count($descendantIds) + 1,
                ]);
            } catch (Throwable $e) {
                $this->logger->error('Failed to remove skill files', [
                    'skill_code' => $skillCode,
                    'agent_code' => $agentCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (! empty($allDeletedFileIds)) {
            $this->pushFileChangeNotification(
                $userId,
                $allDeletedFileIds,
                (string) $projectId,
                $workDir,
                $organizationCode
            );
        }

        $this->skillsMdSyncService->syncSkillsMd(
            $projectId,
            $projectEntity,
            $organizationCode,
            $projectOrgCode,
            $removedPackageNames,
            SkillsMdSyncService::OPERATION_REMOVE
        );

        $this->logger->info('Agent skill file removal completed', [
            'agent_code' => $agentCode,
            'skill_count' => count($skillCodes),
            'project_id' => $projectId,
            'total_files_deleted' => count($allDeletedFileIds),
            'removed_package_count' => count($removedPackageNames),
        ]);
    }

    /**
     * Push file delete notification to the user via WebSocket.
     *
     * @param int[] $fileIds
     */
    private function pushFileChangeNotification(
        string $userId,
        array $fileIds,
        string $projectId,
        string $workDir,
        string $organizationCode
    ): void {
        try {
            $magicId = $this->getMagicIdByUserId($userId);
            if (empty($magicId)) {
                return;
            }

            $changes = [];
            foreach ($fileIds as $fileId) {
                $changes[] = [
                    'operation' => 'delete',
                    'file_id' => (string) $fileId,
                ];
            }

            $pushData = [
                'type' => 'seq',
                'seq' => [
                    'magic_id' => '',
                    'seq_id' => '',
                    'message_id' => '',
                    'refer_message_id' => '',
                    'sender_message_id' => '',
                    'conversation_id' => '',
                    'organization_code' => $organizationCode,
                    'message' => [
                        'type' => 'super_magic_file_change',
                        'project_id' => $projectId,
                        'workspace_id' => $workDir,
                        'topic_id' => '',
                        'changes' => $changes,
                        'timestamp' => date('c'),
                    ],
                ],
            ];

            SocketIOUtil::sendIntermediate(
                SocketEventType::Intermediate,
                $magicId,
                $pushData
            );

            $this->logger->info('Pushed skill file delete notification', [
                'magic_id' => $magicId,
                'project_id' => $projectId,
                'changes_count' => count($changes),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to push skill file notification', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function getMagicIdByUserId(string $userId): string
    {
        try {
            $userEntity = $this->magicUserRepository->getUserById($userId);
            if ($userEntity) {
                return (string) $userEntity->getMagicId();
            }
        } catch (Throwable $e) {
            $this->logger->error('Failed to get magicId', [
                'user_id' => $userId,
                'error' => $e->getMessage(),
            ]);
        }
        return '';
    }
}
