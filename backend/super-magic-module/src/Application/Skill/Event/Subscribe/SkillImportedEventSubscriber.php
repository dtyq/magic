<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Persistence\MagicUserRepository;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\SkillUtil;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use App\Infrastructure\Util\ZipUtil;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Event\SkillImportedEvent;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

#[Listener]
class SkillImportedEventSubscriber implements ListenerInterface
{
    private const LOCK_KEY_FORMAT = 'skill_import_post_process:%s:%s';

    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills/';

    private LoggerInterface $logger;

    public function __construct(
        private readonly ContainerInterface $container,
        private readonly SkillDomainService $skillDomainService,
        private readonly ProjectDomainService $projectDomainService,
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
            SkillImportedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof SkillImportedEvent) {
            return;
        }

        Coroutine::create(function () use ($event) {
            $this->handleSkillImportedEvent($event);
        });
    }

    private function handleSkillImportedEvent(SkillImportedEvent $event): void
    {
        $userAuthorization = $event->getUserAuthorization();
        $skillCode = $event->getSkillCode();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $userId = $userAuthorization->getId();

        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $organizationCode, $skillCode);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->mutexLock($lockKey, $lockOwner, 120)) {
            $this->logger->info('Skip skill import post-process due to lock contention', [
                'skill_code' => $skillCode,
                'organization_code' => $organizationCode,
            ]);
            return;
        }

        try {
            $this->syncSkillFilesToProject($organizationCode, $userId, $skillCode, $userAuthorization);
        } catch (Throwable $e) {
            $this->logger->error('Skill import post-process failed', [
                'skill_code' => $skillCode,
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    private function syncSkillFilesToProject(
        string $organizationCode,
        string $userId,
        string $skillCode,
        mixed $userAuthorization
    ): void {
        $dataIsolation = SkillDataIsolation::create($organizationCode, $userId);
        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $skillCode);

        $projectId = (int) ($skillEntity->getProjectId() ?? 0);
        if ($projectId <= 0) {
            $projectId = $this->createSkillProject($userAuthorization, $userId, $organizationCode, $skillEntity->getPackageName() ?: $skillEntity->getCode());

            $skillEntity->setProjectId($projectId);
            $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
        }

        $fileKey = $skillEntity->getFileKey();
        if ($fileKey === '') {
            throw new RuntimeException('Skill file_key is empty');
        }

        $packageName = $skillEntity->getPackageName();
        if (empty($packageName)) {
            throw new RuntimeException('Skill packageName is empty');
        }

        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($projectEntity === null) {
            throw new RuntimeException('Project not found for imported skill');
        }

        $workDir = $projectEntity->getWorkDir();
        if (empty($workDir)) {
            throw new RuntimeException('Project workDir is empty');
        }

        $projectOrgCode = $projectEntity->getUserOrganizationCode();

        $tempDir = self::TEMP_DIR_BASE . 'import_' . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            $localZipPath = $tempDir . '/' . basename($fileKey);
            $this->fileDomainService->downloadByChunks(
                $organizationCode,
                $fileKey,
                $localZipPath,
                StorageBucketType::Private
            );

            if (! file_exists($localZipPath)) {
                throw new RuntimeException('Skill file download failed');
            }

            $extractDir = $tempDir . '/extracted';
            ZipUtil::extract($localZipPath, $extractDir);

            // Strip wrapper directories in zip (e.g. SKILL-{code}/skill-name/)
            // to find the actual content directory containing SKILL.md
            $actualContentDir = SkillUtil::findSkillMdDirectory($extractDir) ?? $extractDir;

            $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                $projectId,
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                TaskFileSource::SKILL
            );

            $magicDirId = $this->taskFileDomainService->createDirectory(
                $projectId,
                $rootDirId,
                '.magic',
                '.magic',
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                TaskFileSource::SKILL
            );

            $skillsDirId = $this->taskFileDomainService->createDirectory(
                $projectId,
                $magicDirId,
                'skills',
                '.magic/skills',
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                TaskFileSource::SKILL
            );

            $packageDirId = $this->taskFileDomainService->createDirectory(
                $projectId,
                $skillsDirId,
                $packageName,
                '.magic/skills/' . $packageName,
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                TaskFileSource::SKILL
            );

            $contactDataIsolation = DataIsolation::simpleMake($organizationCode, $userId);

            $createdFiles = [];
            $this->uploadExtractedFiles(
                $contactDataIsolation,
                $projectEntity,
                $actualContentDir,
                $packageDirId,
                $projectId,
                '.magic/skills/' . $packageName,
                $workDir,
                $userId,
                $organizationCode,
                $projectOrgCode,
                $createdFiles
            );

            if (! empty($createdFiles)) {
                $this->pushFileChangeNotification(
                    $userId,
                    $createdFiles,
                    (string) $projectId,
                    $workDir,
                    $organizationCode
                );
            }

            $this->logger->info('Skill import post-process completed', [
                'skill_code' => $skillCode,
                'project_id' => $projectId,
                'files_created' => count($createdFiles),
            ]);
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
        ProjectEntity $projectEntity,
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

    private function createSkillProject(
        mixed $userAuthorization,
        string $userId,
        string $organizationCode,
        string $projectName
    ): int {
        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($userAuthorization);
        $requestContext->setUserId($userId);
        $requestContext->setOrganizationCode($organizationCode);

        $projectRequestDTO = new CreateAgentProjectRequestDTO();
        $projectRequestDTO->setProjectName($projectName);
        $projectRequestDTO->setInitTemplateFiles(false);

        $projectResult = $this->getProjectAppService()->createAgentProject(
            $requestContext,
            $projectRequestDTO,
            ProjectMode::CUSTOM_SKILL
        );

        $projectId = (int) ($projectResult['project']['id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Failed to create project for imported skill');
        }

        return $projectId;
    }

    /**
     * Push file change notification to the user via WebSocket.
     *
     * @param TaskFileEntity[] $fileEntities
     */
    private function pushFileChangeNotification(
        string $userId,
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
                    'operation' => 'add',
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

            $this->logger->info('Pushed skill import file notification', [
                'magic_id' => $magicId,
                'project_id' => $projectId,
                'changes_count' => count($changes),
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Failed to push skill import notification', [
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

    private function getProjectAppService(): ProjectAppService
    {
        /* @var ProjectAppService $projectAppService */
        return $this->container->get(ProjectAppService::class);
    }
}
