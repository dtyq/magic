<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\Chat\Service\MagicChatFileAppService;
use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\Common\Config\BatchProcessConfig;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\FileContentSavedEvent;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileVersionDomainService;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Domain\SuperMagic\Workspace\Entity\WorkspaceVersionEntity;
use App\Domain\SuperMagic\Workspace\Service\WorkspaceDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchSaveFileContentRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\RefreshStsTokenRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\SaveFileContentRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\WorkspaceAttachmentsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileInfoResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileNameResponseDTO;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Codec\Json;
use Hyperf\Coroutine\Parallel;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * File Process Application Service
 * Responsible for cross-domain file operations, including checking file existence and updating/creating files.
 */
class FileProcessAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatFileAppService $magicChatFileAppService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileAppService $fileAppService,
        private readonly TopicDomainService $topicDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly LockerInterface $locker,
        private readonly TaskFileVersionDomainService $taskFileVersionDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Find file by file_key, update if exists, create if not exists.
     *
     * @param string $fileKey File key
     * @param DataIsolation $dataIsolation Data isolation object
     * @param array $fileData File data
     * @param int $projectId Project ID
     * @param int $topicId Topic ID
     * @param int $taskId Task ID
     * @param string $fileType File type
     * @return array Returns task file entity and file ID
     */
    public function processFileByFileKey(
        string $fileKey,
        DataIsolation $dataIsolation,
        array $fileData,
        int $projectId,
        int $topicId,
        int $taskId,
        string $fileType = FileType::PROCESS->value,
        string $storageType = StorageType::WORKSPACE->value,
        int $source = TaskFileSource::AGENT->value,
        ?int $parentId = null,
    ): array {
        $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
            dataIsolation: $dataIsolation,
            fileKey: $fileKey,
            fileData: $fileData,
            projectId: $projectId,
            topicId: $topicId,
            taskId: $taskId,
            fileType: $fileType,
            isUpdate: true,
            storageType: $storageType,
            source: $source,
            parentId: $parentId,
        );

        return [$taskFileEntity->getFileId(), $taskFileEntity];
    }

    /**
     * 登记 Tool Detail 引用的内部文件，不经过普通消息附件链路。
     *
     * 当前仅浏览器工具详情截图需要由 Tool Detail 独立登记；其他文件类型继续使用已有附件流程。
     * 未声明存储类型或路径不属于当前项目话题时直接跳过，避免污染 Workspace。
     */
    public function processToolDetailFileReference(?array &$tool, TaskEntity $task, DataIsolation $dataIsolation): void
    {
        if (! is_array($tool['detail']['data'] ?? null)) {
            return;
        }

        $detailData = &$tool['detail']['data'];
        if (! empty($detailData['file_id'])) {
            return;
        }

        $fileKey = trim((string) ($detailData['file_key'] ?? ''));
        $storageType = StorageType::tryFrom((string) ($detailData['storage_type'] ?? ''));
        $fileType = FileType::tryFrom((string) ($detailData['file_tag'] ?? ''));
        if ($fileKey === '' || $storageType !== StorageType::TOPIC || $fileType !== FileType::BROWSER) {
            return;
        }
        try {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($task->getProjectId());
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectEntity->getUserOrganizationCode());
            $screenshotDir = WorkDirectoryUtil::getTopicRootDir(
                $task->getUserId(),
                $task->getProjectId(),
                $task->getTopicId()
            ) . '/screenshots';
            // TODO: Topic 新空间启用时，Snapshot 物理目录应与上传、消息目录同步切换。
            $fullScreenshotDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $screenshotDir);
            if (! WorkDirectoryUtil::checkEffectiveFileKey($fullScreenshotDir, $fileKey)) {
                $this->logger->warning('Tool Detail screenshot path does not belong to the current topic', [
                    'task_id' => $task->getTaskId(),
                    'file_key' => $fileKey,
                ]);
                return;
            }

            $taskFileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
            if ($taskFileEntity === null) {
                $fileName = basename($fileKey);
                if ($fileName === '') {
                    return;
                }

                $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
                    dataIsolation: $dataIsolation,
                    fileKey: $fileKey,
                    fileData: [
                        'filename' => $fileName,
                        'display_filename' => $fileName,
                        'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
                        'file_size' => max(0, (int) ($detailData['file_size'] ?? 0)),
                    ],
                    projectId: $task->getProjectId(),
                    topicId: $task->getTopicId(),
                    taskId: (int) $task->getId(),
                    fileType: $fileType->value,
                    storageType: StorageType::TOPIC->value,
                );
            }

            $taskFileEntity->setStorageType(StorageType::TOPIC);
            $taskFileEntity->setIsHidden(true);
            $taskFileEntity->setParentId(null);
            $taskFileEntity->setOrganizationCode($projectEntity->getUserOrganizationCode());
            $this->taskFileDomainService->updateById($taskFileEntity);

            $detailData['file_id'] = (string) $taskFileEntity->getFileId();
        } catch (Throwable $e) {
            $this->logger->warning('Failed to register Tool Detail file reference', [
                'task_id' => $task->getTaskId(),
                'file_key' => $fileKey,
                'storage_type' => $storageType->value,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Process initial attachments, save user uploaded attachments to task file table.
     *
     * @param null|string $attachments Attachments JSON string
     * @param TaskEntity $task Task entity
     * @param DataIsolation $dataIsolation Data isolation object
     * @return array Processing result statistics
     */
    public function processInitialAttachments(?string $attachments, TaskEntity $task, DataIsolation $dataIsolation): array
    {
        $stats = [
            'total' => 0,
            'success' => 0,
            'error' => 0,
        ];

        if (empty($attachments)) {
            return $stats;
        }

        try {
            $attachmentsData = Json::decode($attachments);
            if (empty($attachmentsData) || ! is_array($attachmentsData)) {
                $this->logger->warning(sprintf(
                    'Attachment data format error, Task ID: %s, Original attachment data: %s',
                    $task->getTaskId(),
                    $attachments
                ));
                return $stats;
            }

            $stats['total'] = count($attachmentsData);

            $this->logger->info(sprintf(
                'Starting to process initial attachments, Task ID: %s, Attachment count: %d',
                $task->getTaskId(),
                $stats['total']
            ));

            // Process each attachment
            foreach ($attachmentsData as $attachment) {
                // Ensure file_id exists
                if (empty($attachment['file_id'])) {
                    $this->logger->warning(sprintf(
                        'Attachment missing file_id, Task ID: %s, Attachment content: %s',
                        $task->getTaskId(),
                        json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    ));
                    ++$stats['error'];
                    continue;
                }

                // Get complete file information
                $fileInfo = $this->magicChatFileAppService->getFileInfo($attachment['file_id']);
                if (empty($fileInfo)) {
                    $this->logger->warning(sprintf(
                        'Attachment file not found, File ID: %s, Task ID: %s',
                        $attachment['file_id'],
                        $task->getTaskId()
                    ));
                    ++$stats['error'];
                    continue;
                }

                // Build complete attachment information
                $completeAttachment = [
                    'file_id' => $attachment['file_id'],
                    'file_key' => $fileInfo['file_key'],
                    'file_extension' => $fileInfo['file_extension'],
                    'filename' => $fileInfo['file_name'],
                    'display_filename' => $fileInfo['file_name'],
                    'file_size' => $fileInfo['file_size'],
                    'file_tag' => FileType::USER_UPLOAD->value,
                    'file_url' => $fileInfo['external_url'] ?? '',
                    'storage_type' => $attachment['storage_type'] ?? StorageType::WORKSPACE->value,
                ];

                // Process single attachment
                try {
                    $this->processFileByFileKey(
                        $completeAttachment['file_key'],
                        $dataIsolation,
                        $completeAttachment,
                        $task->getProjectId(),
                        $task->getTopicId(),
                        (int) $task->getId(),
                        FileType::USER_UPLOAD->value,
                        StorageType::WORKSPACE->value,
                        TaskFileSource::AGENT->value,
                    );
                    ++$stats['success'];
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'Failed to process single initial attachment: %s, File ID: %s, Task ID: %s',
                        $e->getMessage(),
                        $completeAttachment['file_id'] ?? 'Unknown',
                        $task->getTaskId()
                    ));
                    ++$stats['error'];
                }
            }

            $this->logger->info(sprintf(
                'Initial attachment processing completed, Task ID: %s, Processing result: Total=%d, Success=%d, Failed=%d',
                $task->getTaskId(),
                $stats['total'],
                $stats['success'],
                $stats['error']
            ));

            return $stats;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Overall initial attachment processing failed: %s, Task ID: %s',
                $e->getMessage(),
                $task->getTaskId()
            ));
            $stats['error'] = $stats['total'];
            return $stats;
        }
    }

    /**
     * Refresh STS Token.
     *
     * @param RefreshStsTokenRequestDTO $requestDTO Request DTO
     * @return array Refresh result
     */
    public function refreshStsToken(RefreshStsTokenRequestDTO $requestDTO): array
    {
        $projectId = (int) $requestDTO->getProjectId();
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_id_required');
        }

        // STS credentials grant access to the project's work directory. Resolve the
        // project through the authenticated user's access scope before issuing them.
        $projectEntity = $this->getAccessibleProject(
            $projectId,
            $requestDTO->getUserId(),
            $requestDTO->getOrganizationCode(),
        );

        try {
            // Use project's workdir as working directory
            $projectDir = WorkDirectoryUtil::getRootDir($projectEntity->getUserId(), $projectEntity->getId());

            // Get STS temporary credentials
            $storageType = StorageBucketType::SandBox->value;
            $expires = 3600; // Credential valid for 1 hour

            // Create user authorization object
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($requestDTO->getOrganizationCode());

            // Use unified FileAppService to get STS Token (with dual endpoint)
            // 与沙箱初始化保持一致：凭证需同时含上传与删除权限（如 checkpoint 清理）
            return $this->fileAppService->getDualEndpointStsCredentialV2(
                $projectEntity->getUserOrganizationCode(),
                $storageType,
                $projectDir,
                $expires,
                false,
                ['sts_type' => 'upload_objects|del_objects']
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to refresh STS Token: %s, Organization code: %s, Project ID: %s, Sandbox ID: %s',
                $e->getMessage(),
                $requestDTO->getOrganizationCode(),
                $requestDTO->getProjectId(),
                $requestDTO->getSandboxId()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
        }
    }

    /**
     * Save file content to object storage.
     *
     * @param SaveFileContentRequestDTO $requestDTO Request DTO
     * @param MagicUserAuthorization $authorization User authorization
     * @return array Response data
     */
    public function saveFileContent(SaveFileContentRequestDTO $requestDTO, MagicUserAuthorization $authorization): array
    {
        $fileId = $requestDTO->getFileId();
        $lockKey = 'file_save_lock:' . $fileId;
        $lockOwner = IdGenerator::getUniqueId32();
        $lockExpireSeconds = 30;
        $lockAcquired = false;

        try {
            // Try to acquire distributed mutex lock
            $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockExpireSeconds);

            if ($lockAcquired) {
                $this->logger->debug(sprintf('File save lock acquired for file %d by %s', $fileId, $lockOwner));

                // Execute file save logic
                $result = $this->performFileSave($requestDTO, $authorization);

                $this->logger->debug(sprintf('File save completed for file %d by %s', $fileId, $lockOwner));

                return $result;
            }
            $this->logger->warning(sprintf('Failed to acquire mutex lock for file %d. It might be held by another instance.', $fileId));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_CONCURRENT_MODIFICATION, 'file.concurrent_modification');
        } finally {
            // Release lock if acquired
            if ($lockAcquired) {
                if ($this->locker->release($lockKey, $lockOwner)) {
                    $this->logger->debug(sprintf('File save lock released for file %d by %s', $fileId, $lockOwner));
                } else {
                    $this->logger->error(sprintf('Failed to release file save lock for file %d held by %s. Manual intervention may be required.', $fileId, $lockOwner));
                }
            }
        }
    }

    public function workspaceAttachments(WorkspaceAttachmentsRequestDTO $requestDTO): array
    {
        $topic = $this->topicDomainService->getTopicOnlyByChatTopicId($requestDTO->getTopicId());
        if (empty($topic)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.not_found');
        }

        // task 表无 sandbox_id 索引，改用 topic 当前任务按主键做存在性校验
        $task = $this->taskDomainService->getTaskById((int) $topic->getCurrentTaskId());
        if (empty($task)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.not_found');
        }

        if ($requestDTO->getFolder() === '.chat_history') {
            $topic->setChatHistoryCommitHash($requestDTO->getCommitHash());
        }

        if ($requestDTO->getFolder() === '.workspace') {
            $topic->setWorkspaceCommitHash($requestDTO->getCommitHash());
        }

        // Add new workspace version record
        $versionEntity = new WorkspaceVersionEntity();
        $versionEntity->setId(IdGenerator::getSnowId());
        $versionEntity->setTopicId((int) $topic->getId());
        $versionEntity->setProjectId($topic->getProjectId());
        $versionEntity->setSandboxId($requestDTO->getSandboxId());
        $versionEntity->setCommitHash($requestDTO->getCommitHash());
        $versionEntity->setDir(json_encode($requestDTO->getDir()));
        $versionEntity->setFolder($requestDTO->getFolder());
        $versionEntity->setCreatedAt(date('Y-m-d H:i:s'));
        $versionEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        # 根据project_id 获取最新的一条tag，如果tag为0，则设置为1，否则设置为tag+1
        $latestVersion = $this->workspaceDomainService->getLatestVersionByProjectId($versionEntity->getProjectId());
        if ($latestVersion) {
            $versionEntity->setTag($latestVersion->getTag() + 1);
        } else {
            $versionEntity->setTag(1);
        }

        // Add Redis lock for topic_id to prevent concurrent modifications
        $lockKey = 'workspace_attachments_topic_lock:' . $topic->getId();
        $lockOwner = IdGenerator::getUniqueId32(); // Use unique ID as lock owner
        $lockExpireSeconds = 30; // Lock expiration time in seconds
        $lockAcquired = false;

        try {
            // Try to acquire distributed mutex lock
            $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, $lockExpireSeconds);

            if (! $lockAcquired) {
                $this->logger->warning(sprintf(
                    'Failed to acquire workspace attachments lock for topic %s. Concurrent operation may be in progress.',
                    $topic->getId()
                ));
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_LOCK_FAILED, 'topic.concurrent_operation_failed');
            }

            $this->logger->debug(sprintf('Lock acquired for topic %s by %s', $topic->getId(), $lockOwner));

            // Use transaction to ensure atomicity of topic update and workspace version creation
            Db::transaction(function () use ($topic, $versionEntity) {
                $bool = $this->topicDomainService->updateTopicWhereUpdatedAt($topic, $topic->getUpdatedAt());
                if (! $bool) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_LOCK_FAILED, 'topic.concurrent_operation_failed');
                }
                $this->workspaceDomainService->createWorkspaceVersion($versionEntity);
            });

            $this->logger->debug(sprintf('Workspace attachments operation completed for topic %s', $topic->getId()));
            return ['success' => true];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to add workspace version record: %s, Topic ID: %s, Sandbox ID: %s',
                $e->getMessage(),
                $topic->getId(),
                $requestDTO->getSandboxId()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_WORKSPACE_VERSION_FAILED, $e->getMessage());
        } finally {
            // Ensure lock is released even if an exception occurs
            if ($lockAcquired) {
                $this->locker->release($lockKey, $lockOwner);
                $this->logger->debug(sprintf('Lock released for topic %s by %s', $topic->getId(), $lockOwner));
            }
        }
    }

    /**
     * Batch save file content with concurrent processing.
     *
     * @param BatchSaveFileContentRequestDTO $requestDTO Batch request DTO
     * @param MagicUserAuthorization $authorization User authorization
     * @return array Batch response data
     */
    public function batchSaveFileContent(BatchSaveFileContentRequestDTO $requestDTO, MagicUserAuthorization $authorization): array
    {
        $files = $requestDTO->getFiles();
        $stats = [
            'total' => count($files),
            'success' => 0,
            'error' => 0,
            'results' => [],
            'errors' => [],
        ];

        $this->logger->info(sprintf(
            'Starting concurrent batch file save operation - user: %s, organization: %s, file_count: %d',
            $authorization->getId(),
            $authorization->getOrganizationCode(),
            $stats['total']
        ));

        // Record deduplication information
        $deduplicatedCount = $requestDTO->getDeduplicatedCount();
        if ($deduplicatedCount > 0) {
            $this->logger->info(sprintf(
                'File deduplication applied - original_count: %d, after_dedup: %d, deduplicated: %d',
                $requestDTO->getOriginalCount(),
                $stats['total'],
                $deduplicatedCount
            ));
        }

        // Dynamically adjust concurrency strategy based on configuration and file count
        $fileCount = count($files);
        $enableConcurrency = BatchProcessConfig::shouldEnableConcurrency($fileCount);
        $maxConcurrency = BatchProcessConfig::getMaxConcurrency($fileCount);
        $startTime = microtime(true);

        $this->logger->info(sprintf(
            'Batch processing strategy - concurrent: %s, max_concurrency: %d, file_count: %d',
            $enableConcurrency ? 'enabled' : 'disabled',
            $maxConcurrency,
            $fileCount
        ));

        // Create concurrent tasks
        $tasks = [];
        foreach ($files as $index => $fileDTO) {
            $tasks[$index] = function () use ($fileDTO, $authorization, $index) {
                // Record task start time
                $taskStartTime = microtime(true);

                try {
                    // Use existing single file save logic
                    $result = $this->saveFileContent($fileDTO, $authorization);

                    $taskDuration = round((microtime(true) - $taskStartTime) * 1000, 2);

                    $this->logger->debug(sprintf(
                        'Concurrent save - file %d completed successfully, file_id: %d, duration: %sms',
                        $index + 1,
                        $fileDTO->getFileId(),
                        $taskDuration
                    ));

                    return [
                        'index' => $index,
                        'file_id' => $fileDTO->getFileId(),
                        'status' => 'success',
                        'data' => $result,
                        'duration_ms' => $taskDuration,
                    ];
                } catch (Throwable $e) {
                    $taskDuration = round((microtime(true) - $taskStartTime) * 1000, 2);

                    $this->logger->error(sprintf(
                        'Concurrent save - file %d failed, file_id: %d, error: %s, duration: %sms',
                        $index + 1,
                        $fileDTO->getFileId(),
                        $e->getMessage(),
                        $taskDuration
                    ));

                    return [
                        'index' => $index,
                        'file_id' => $fileDTO->getFileId(),
                        'status' => 'error',
                        'error' => $e->getMessage(),
                        'error_code' => $e->getCode(),
                        'duration_ms' => $taskDuration,
                    ];
                }
            };
        }

        // Execute tasks based on strategy
        if ($enableConcurrency) {
            // Execute tasks concurrently
            $parallel = new Parallel($maxConcurrency);
            foreach ($tasks as $index => $task) {
                $parallel->add($task, $index);
            }
            $results = $parallel->wait();
        } else {
            // Execute tasks serially (suitable for small number of files)
            $results = [];
            foreach ($tasks as $index => $task) {
                $results[$index] = $task();
            }
        }

        // Process results
        foreach ($results as $result) {
            if ($result['status'] === 'success') {
                $stats['results'][] = $result;
                ++$stats['success'];
            } else {
                $stats['errors'][] = $result;
                ++$stats['error'];
            }
        }

        $totalDuration = round((microtime(true) - $startTime) * 1000, 2);

        $this->logger->info(sprintf(
            'Concurrent batch file save operation completed - user: %s, total: %d, success: %d, error: %d, total_duration: %sms, avg_duration: %sms',
            $authorization->getId(),
            $stats['total'],
            $stats['success'],
            $stats['error'],
            $totalDuration,
            $stats['total'] > 0 ? round($totalDuration / $stats['total'], 2) : 0
        ));

        return [
            'batch_id' => IdGenerator::getUniqueId32(),
            'total' => $stats['total'],
            'success' => $stats['success'],
            'error' => $stats['error'],
            'success_files' => $stats['results'],
            'error_files' => $stats['errors'],
            'performance' => [
                'total_duration_ms' => $totalDuration,
                'avg_duration_ms' => $stats['total'] > 0 ? round($totalDuration / $stats['total'], 2) : 0,
                'max_concurrency' => $maxConcurrency,
                'concurrent_enabled' => $enableConcurrency,
                'processing_strategy' => $enableConcurrency ? 'concurrent' : 'sequential',
            ],
            'completed_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * Save tool message content to object storage.
     *
     * @param string $fileName File name
     * @param string $workDir Working directory
     * @param string $fileKey File key
     * @param string $content File content
     * @param DataIsolation $dataIsolation Data isolation object
     * @param int $projectId Project ID
     * @param int $topicId Topic ID
     * @param int $taskId Task ID
     * @return int Returns file ID
     */
    public function saveToolMessageContent(
        string $fileName,
        string $workDir,
        string $fileKey,
        string $content,
        DataIsolation $dataIsolation,
        int $projectId,
        int $topicId,
        int $taskId
    ): int {
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        $projectOrganizationCode = $projectEntity->getUserOrganizationCode();

        $this->logger->info(sprintf(
            'Starting to save tool message content, File name: %s, File size: %d bytes, Task ID: %d',
            $fileName,
            strlen($content),
            $taskId
        ));

        try {
            // Construct complete file path
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectOrganizationCode);
            $fullFileKey = WorkDirectoryUtil::getFullFileKey($fullPrefix, $workDir, $fileKey);

            // 1. Check if file already exists
            $existingFile = $this->taskDomainService->getTaskFileByFileKey($fullFileKey, $topicId);
            if ($existingFile) {
                $this->logger->info(sprintf(
                    'File already exists, returning existing file ID: %d, File key: %s',
                    $existingFile->getFileId(),
                    $fullFileKey
                ));
                return $existingFile->getFileId();
            }

            // 2. Upload file to object storage
            // 2. Directly use production-verified uploadFileContent method
            $uploadResult = $this->uploadFileContent(
                $content,
                $fullFileKey,
                $fileName,
                pathinfo($fileName, PATHINFO_EXTENSION),
                $projectOrganizationCode
            );

            // 3. Build file data
            $fileData = [
                'file_key' => $fullFileKey,
                'file_extension' => pathinfo($fileName, PATHINFO_EXTENSION),
                'filename' => $fileName,
                'display_filename' => $fileName,
                'file_size' => $uploadResult['size'],
                'file_tag' => FileType::TOOL_MESSAGE_CONTENT,
                'file_url' => $uploadResult['url'] ?? '',
                'storage_type' => StorageType::TOPIC->value,
            ];

            // 4. Save file information to database
            $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
                dataIsolation: $dataIsolation,
                fileKey: $fullFileKey,
                fileData: $fileData,
                projectId: $projectId,
                topicId: $topicId,
                taskId: $taskId,
                fileType: 'tool_message_content',
                isUpdate: false,
                storageType: StorageType::TOPIC->value,
                source: TaskFileSource::AGENT->value,
            );

            // 5. Set as hidden file
            $taskFileEntity->setIsHidden(true);
            $this->taskDomainService->updateTaskFile($taskFileEntity);

            $this->logger->info(sprintf(
                'Tool message content saved successfully, File ID: %d, File key: %s',
                $taskFileEntity->getFileId(),
                $fullFileKey
            ));

            return $taskFileEntity->getFileId();
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to save tool message content: %s, File name: %s, Task ID: %d',
                $e->getMessage(),
                $fileName,
                $taskId
            ));
            throw $e;
        }
    }

    public function getGitDir(string $fileKey): string
    {
        return '.workspace';
    }

    /**
     * Get file name by file ID.
     *
     * @param int $fileId File ID
     * @return array File name response
     */
    public function getFileNameById(int $fileId): array
    {
        // Get file entity by ID
        $taskFileEntity = $this->taskFileDomainService->getById($fileId);

        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        // Create response DTO and return
        $responseDTO = new FileNameResponseDTO($taskFileEntity->getFileName());
        return $responseDTO->toArray();
    }

    /**
     * Get file basic information by file ID.
     * Validates user has access to the project that contains this file.
     *
     * @param RequestContext $requestContext Request context with user authorization
     * @param int $fileId File ID
     * @return array File basic information (file name, current version, organization code)
     */
    public function getFileInfoById(RequestContext $requestContext, int $fileId): array
    {
        // Get file entity by ID
        $taskFileEntity = $this->taskFileDomainService->getById($fileId);

        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.not_found');
        }

        // 校验项目访问权限，用户空间文件改走 owner 权限。
        $userAuthorization = $requestContext->getUserAuthorization();
        $this->getAccessibleProjectForTaskFile(
            $taskFileEntity,
            $userAuthorization,
            MemberRole::VIEWER,
        );

        // Get current version (latest version number) - optimized for performance
        $currentVersion = $this->taskFileVersionDomainService->getLatestVersionNumber($fileId);

        // Create response DTO and return
        $responseDTO = new FileInfoResponseDTO(
            $taskFileEntity->getFileName(),
            $currentVersion,
            $taskFileEntity->getOrganizationCode(),
            $this->buildRelativeFilePathForEntity($taskFileEntity, $taskFileEntity->getProjectId())
        );
        return $responseDTO->toArray();
    }

    private function buildRelativeFilePathForEntity(TaskFileEntity $entity, int $projectId): string
    {
        $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds(
            [$entity->getFileId()],
            $projectId
        );
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);
        $fileMap[$entity->getFileId()] = $entity;

        return RelativeFilePathUtil::buildPathByParentChain($entity, $fileMap);
    }

    /**
     * Perform actual file save logic.
     *
     * @param SaveFileContentRequestDTO $requestDTO Request DTO
     * @param MagicUserAuthorization $authorization User authorization
     * @return array Response data
     */
    private function performFileSave(SaveFileContentRequestDTO $requestDTO, MagicUserAuthorization $authorization): array
    {
        // 1. Validate file permission
        $taskFileEntity = $this->validateFilePermission((int) $requestDTO->getFileId(), $authorization);

        $projectEntity = $this->getAccessibleProjectForTaskFile(
            $taskFileEntity,
            $authorization,
            MemberRole::EDITOR,
        );
        $storageOrganizationCode = $projectEntity?->getUserOrganizationCode()
            ?? $taskFileEntity->getOrganizationCode();

        // 校验编辑基准，避免旧正文覆盖文件系统中的最新内容。
        $this->assertExpectedRevisionMatches($taskFileEntity, $requestDTO->getExpectedRevision());

        // 2. Process content (decode shadow if enabled)
        $content = $requestDTO->getContent();
        if ($requestDTO->getEnableShadow()) {
            $content = ShadowCode::unShadow($content);
            $this->logger->info(sprintf(
                'Shadow decoding enabled for file %d, original content size: %d, decoded content size: %d',
                $requestDTO->getFileId(),
                strlen($requestDTO->getContent()),
                strlen($content)
            ));
        }

        // 3. Upload file content (replace existing content using file_key)
        $result = $this->uploadFileContent(
            $content,
            $taskFileEntity->getFileKey(),
            $taskFileEntity->getFileName(),
            $taskFileEntity->getFileExtension(),
            $storageOrganizationCode,
            $taskFileEntity->getFileId()
        );

        // 4. Update file metadata
        $revision = $this->updateFileMetadata($taskFileEntity, $result, $authorization);

        // 5. 创建文件版本
        $versionEntity = $this->taskFileVersionDomainService->createFileVersion($storageOrganizationCode, $taskFileEntity);

        return [
            'file_id' => $requestDTO->getFileId(),
            'size' => $result['size'],
            'updated_at' => date('Y-m-d H:i:s'),
            'version' => $versionEntity?->getVersion(),
            'revision' => $revision,
            'shadow_decoded' => $requestDTO->getEnableShadow(),
        ];
    }

    /**
     * 校验文件修订号，未传修订号时保持旧调用兼容。
     */
    private function assertExpectedRevisionMatches(TaskFileEntity $taskFileEntity, ?int $expectedRevision): void
    {
        if ($expectedRevision === null) {
            return;
        }

        if (! $taskFileEntity->matchesMetadataRevision($expectedRevision)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_CONCURRENT_MODIFICATION,
                'file.concurrent_modification'
            );
        }
    }

    /**
     * 校验文件读取权限。
     *
     * 项目文件沿用项目权限，用户空间文件使用 task_files 中的 owner 信息。
     */
    private function validateFilePermission(int $fileId, MagicUserAuthorization $authorization): TaskFileEntity
    {
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);
        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        $this->getAccessibleProjectForTaskFile(
            $taskFileEntity,
            $authorization,
            MemberRole::VIEWER,
        );

        return $taskFileEntity;
    }

    /**
     * Upload file content to object storage.
     *
     * @param string $content File content
     * @param string $fileKey File key
     * @param string $fileName File name
     * @param string $fileExtension File extension
     * @param string $projectOrganizationCode Organization code
     * @param null|int $fileId File ID (optional, for logging)
     * @return array Upload result
     */
    private function uploadFileContent(string $content, string $fileKey, string $fileName, string $fileExtension, string $projectOrganizationCode, ?int $fileId = null): array
    {
        try {
            // Log debug information
            $this->logger->info(sprintf(
                'Starting file upload - file_id: %s, file_key: %s, file_name: %s, file_extension: %s, organization: %s, content_size: %d',
                $fileId ?? 'N/A',
                $fileKey,
                $fileName,
                $fileExtension,
                $projectOrganizationCode,
                strlen($content)
            ));

            // Step 1: Save upload content to temporary file with correct file extension
            $tempFile = tempnam(sys_get_temp_dir(), 'file_save_');

            // Ensure temporary file has correct extension
            if (! empty($fileExtension)) {
                $tempFileWithExt = $tempFile . '.' . $fileExtension;
                rename($tempFile, $tempFileWithExt);
                $tempFile = $tempFileWithExt;
            }

            file_put_contents($tempFile, $content);

            $this->logger->info(sprintf(
                'Created temporary file with correct extension: %s, size: %d bytes',
                $tempFile,
                filesize($tempFile)
            ));

            // Step 2: Build UploadFile object
            $uploadKeyPrefix = $this->taskFileDomainService->getFullPrefix($projectOrganizationCode);
            $uploadFileKey = str_replace($uploadKeyPrefix, '', $fileKey);
            $uploadFileKey = ltrim($uploadFileKey, '/');
            $uploadFile = new UploadFile($tempFile, $uploadKeyPrefix, $uploadFileKey, false);

            $this->logger->info(sprintf(
                'Created UploadFile object with file_key: %s',
                $uploadFile->getKey()
            ));

            // Step 3: Upload using FileDomainService uploadByCredential method
            $this->fileDomainService->uploadByCredential($projectOrganizationCode, $uploadFile, StorageBucketType::SandBox, false);

            $fileLink = $this->fileDomainService->getLink($projectOrganizationCode, $fileKey, StorageBucketType::SandBox);

            $this->logger->info(sprintf(
                'Successfully uploaded file using uploadByCredential with key: %s, file_link: %s',
                $uploadFile->getKey(),
                $fileLink->getUrl()
            ));

            // Clean up temporary file
            unlink($tempFile);

            $this->logger->info(sprintf(
                'Cleaned up temporary file: %s',
                $tempFile
            ));

            // Step 4: Return upload result
            return [
                'size' => strlen($content),
                'key' => $fileKey, // Keep original file_key unchanged
                'url' => $fileLink->getUrl(),
            ];
        } catch (Throwable $e) {
            // Clean up temporary file if it exists
            if (isset($tempFile) && file_exists($tempFile)) {
                unlink($tempFile);
            }

            $this->logger->error(sprintf(
                'File upload failed: %s, file_id: %s, organization: %s',
                $e->getMessage(),
                $fileId ?? 'N/A',
                $projectOrganizationCode
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_UPLOAD_FAILED, 'file.upload_failed');
        }
    }

    /**
     * Update file metadata.
     *
     * @param TaskFileEntity $taskFileEntity Task file entity
     * @param array $result Upload result
     * @param MagicUserAuthorization $authorization User authorization
     */
    private function updateFileMetadata(TaskFileEntity $taskFileEntity, array $result, MagicUserAuthorization $authorization): int
    {
        $nextRevision = $taskFileEntity->getMetadataVersion() + 1;

        // Update file size via MagicFS to keep metadata version chain in sync.
        $taskFileEntity = $this->magicFSFileDomainService->updateFile(
            (string) $taskFileEntity->getFileId(),
            ['size' => $result['size']]
        );

        // User-space saves must notify too. Long-term memory lives there.
        $shouldNotify = $this->taskFileDomainService->isProjectSpaceFile($taskFileEntity)
            || $taskFileEntity->getSpaceType() === FileSpaceType::USER->value;
        if (! $shouldNotify) {
            return $nextRevision;
        }

        // Dispatch file content saved event for WebSocket notification
        $event = new FileContentSavedEvent(
            $taskFileEntity,
            $authorization->getId(),
            $authorization->getOrganizationCode()
        );
        AsyncEventUtil::dispatch($event);
        $this->logger->info(sprintf(
            'Dispatched FileContentSavedEvent for file content saved, fileId: %d, userId: %s, organization: %s',
            $taskFileEntity->getFileId(),
            $authorization->getId(),
            $authorization->getOrganizationCode()
        ));

        return $nextRevision;
    }
}
