<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\SkillUtil;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Infrastructure\Util\ZipUtil;
use Dtyq\SuperMagic\Domain\Agent\Event\AgentSkillsAddedEvent;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
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

    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/agent_skills/';

    private LoggerInterface $logger;

    public function __construct(
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly SkillRepositoryInterface $skillRepository,
        private readonly FileDomainService $fileDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly MagicUserRepository $magicUserRepository,
        private readonly LockerInterface $locker,
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
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    private function syncSkillFiles(AgentSkillsAddedEvent $event): void
    {
        $dataIsolation = $event->getDataIsolation();
        $agentCode = $event->getAgentCode();
        $skillCodes = $event->getSkillCodes();
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

        $skillsDirId = $this->taskFileDomainService->createDirectory(
            $projectId,
            $rootDirId,
            'skills',
            'skills',
            $workDir,
            $userId,
            $organizationCode,
            $projectOrgCode,
            TaskFileSource::SKILL
        );

        $skillDataIsolation = SkillDataIsolation::create($organizationCode, $userId);
        $skillDataIsolation->disabled();

        $allCreatedFiles = [];

        foreach ($skillCodes as $skillCode) {
            try {
                $createdFiles = $this->syncSingleSkill(
                    $skillDataIsolation,
                    $skillCode,
                    $projectId,
                    $skillsDirId,
                    $workDir,
                    $userId,
                    $organizationCode,
                    $projectOrgCode,
                    $projectEntity
                );
                $allCreatedFiles = array_merge($allCreatedFiles, $createdFiles);
            } catch (Throwable $e) {
                $this->logger->error('Failed to sync skill file', [
                    'skill_code' => $skillCode,
                    'agent_code' => $event->getAgentCode(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if (! empty($allCreatedFiles)) {
            $this->pushFileChangeNotification(
                $userId,
                'add',
                $allCreatedFiles,
                (string) $projectId,
                $workDir,
                $organizationCode
            );
        }

        $this->logger->info('Agent skill file sync completed', [
            'agent_code' => $agentCode,
            'skill_codes' => $skillCodes,
            'project_id' => $projectId,
            'files_created' => count($allCreatedFiles),
        ]);
    }

    /**
     * @return TaskFileEntity[]
     */
    private function syncSingleSkill(
        SkillDataIsolation $skillDataIsolation,
        string $skillCode,
        int $projectId,
        int $skillsDirId,
        string $workDir,
        string $userId,
        string $organizationCode,
        string $projectOrgCode,
        mixed $projectEntity
    ): array {
        $skillEntity = $this->skillRepository->findByCode($skillDataIsolation, $skillCode);
        if ($skillEntity === null) {
            $this->logger->warning('Skill not found', ['skill_code' => $skillCode]);
            return [];
        }

        $fileKey = $skillEntity->getFileKey();
        if (empty($fileKey)) {
            $this->logger->warning('Skill file_key is empty', ['skill_code' => $skillCode]);
            return [];
        }

        $packageName = $skillEntity->getPackageName();
        if (empty($packageName)) {
            $this->logger->warning('Skill packageName is empty', ['skill_code' => $skillCode]);
            return [];
        }

        $skillOrganizationCode = $skillEntity->getOrganizationCode();

        $tempDir = self::TEMP_DIR_BASE . 'sync_' . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            $localZipPath = $tempDir . '/' . basename($fileKey);
            $this->fileDomainService->downloadByChunks(
                $skillOrganizationCode,
                $fileKey,
                $localZipPath,
                StorageBucketType::Private
            );

            if (! file_exists($localZipPath)) {
                $this->logger->error('Skill file download failed', ['skill_code' => $skillCode, 'file_key' => $fileKey]);
                return [];
            }

            $extractDir = $tempDir . '/extracted';
            ZipUtil::extract($localZipPath, $extractDir);

            // Strip wrapper directories in zip (e.g. SKILL-{code}/skill-name/)
            // to find the actual content directory containing SKILL.md
            $actualContentDir = SkillUtil::findSkillMdDirectory($extractDir) ?? $extractDir;

            $packageDirId = $this->taskFileDomainService->createDirectory(
                $projectId,
                $skillsDirId,
                $packageName,
                'skills/' . $packageName,
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                TaskFileSource::SKILL
            );

            $dataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

            $createdFiles = [];
            $this->uploadExtractedFiles(
                $dataIsolation,
                $projectEntity,
                $actualContentDir,
                $packageDirId,
                $projectId,
                'skills/' . $packageName,
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                $createdFiles
            );

            return $createdFiles;
        } finally {
            ZipUtil::removeDirectory($tempDir);
        }
    }

    /**
     * Recursively upload extracted files and directories to the project.
     *
     * @param TaskFileEntity[] $createdFiles Collects created file entities for notification
     */
    private function uploadExtractedFiles(
        DataIsolation $dataIsolation,
        mixed $projectEntity,
        string $localDir,
        int $parentDirId,
        int $projectId,
        string $relativePath,
        string $workDir,
        string $userId,
        string $organizationCode,
        string $projectOrgCode,
        array &$createdFiles
    ): void {
        $items = array_diff(scandir($localDir), ['.', '..']);

        foreach ($items as $item) {
            $localPath = $localDir . '/' . $item;
            $itemRelativePath = $relativePath . '/' . $item;

            if (is_dir($localPath)) {
                $subDirId = $this->taskFileDomainService->createDirectory(
                    $projectId,
                    $parentDirId,
                    $item,
                    $itemRelativePath,
                    $workDir,
                    $userId,
                    $organizationCode,
                    $projectOrgCode,
                    TaskFileSource::SKILL
                );

                $this->uploadExtractedFiles(
                    $dataIsolation,
                    $projectEntity,
                    $localPath,
                    $subDirId,
                    $projectId,
                    $itemRelativePath,
                    $workDir,
                    $userId,
                    $organizationCode,
                    $projectOrgCode,
                    $createdFiles
                );
            } else {
                $content = file_get_contents($localPath);
                if ($content === false) {
                    $this->logger->warning('Failed to read file', ['path' => $localPath]);
                    continue;
                }

                $fileEntity = $this->taskFileDomainService->createProjectFileWithContent(
                    $dataIsolation,
                    $projectEntity,
                    $parentDirId,
                    $item,
                    $content,
                    TaskFileSource::SKILL
                );

                $createdFiles[] = $fileEntity;
            }
        }
    }

    /**
     * Push file change notification to the user via WebSocket.
     *
     * @param TaskFileEntity[] $fileEntities
     */
    private function pushFileChangeNotification(
        string $userId,
        string $operation,
        array $fileEntities,
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
            foreach ($fileEntities as $fileEntity) {
                $fileDto = TaskFileItemDTO::fromEntity($fileEntity, $workDir);
                $changes[] = [
                    'operation' => $operation,
                    'file_id' => (string) $fileEntity->getFileId(),
                    'file' => $fileDto->toArray(),
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

            $this->logger->info('Pushed skill file add notification', [
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
