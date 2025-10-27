<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatFileAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Application\SuperAgent\Config\BatchProcessConfig;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\FileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\WorkspaceVersionEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveFileContentRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RefreshStsTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveFileContentRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileInfoResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileNameResponseDTO;
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
     * Batch process attachment array, check if exists by fileKey, skip if exists, save if not exists.
     *
     * @param array $attachments Attachment array
     * @param string $sandboxId Sandbox ID
     * @param string $organizationCode Organization code
     * @param null|int $topicId Topic ID, will be retrieved from task record if not provided
     * @return array Processing result statistics
     */
    public function processAttachmentsArray(array $attachments, string $sandboxId, string $organizationCode, ?int $topicId = null): array
    {
        $stats = [
            'total' => count($attachments),
            'success' => 0,
            'skipped' => 0,
            'error' => 0,
            'files' => [],
        ];

        if (empty($attachments)) {
            return $stats;
        }

        // Create data isolation object
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        $task = null;
        // If topicId not provided, retrieve from task record
        if ($topicId === null) {
            $task = $this->taskDomainService->getTaskBySandboxId($sandboxId);
            if (empty($task)) {
                $this->logger->error(sprintf('Unable to find task, Sandbox ID: %s', $sandboxId));
                $stats['error'] = $stats['total'];
                return $stats;
            }
            $topicId = $task->getTopicId();
        }
        $dataIsolation->setCurrentUserId($task->getUserId());

        $this->logger->info(sprintf(
            'Starting batch attachment processing, Sandbox ID: %s, Attachment count: %d',
            $sandboxId,
            $stats['total']
        ));

        Db::beginTransaction();
        try {
            // 对每个附件进行处理
            foreach ($attachments as $attachment) {
                // Ensure file_key exists
                if (empty($attachment['file_key'])) {
                    $this->logger->warning(sprintf(
                        'Attachment missing file_key, Sandbox ID: %s, Attachment content: %s',
                        $sandboxId,
                        json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    ));
                    ++$stats['error'];
                    continue;
                }
                try {
                    // Ensure task exists and has ID
                    if (empty($task) || empty($task->getId())) {
                        $this->logger->error(sprintf('Unable to find task or task ID is empty, Sandbox ID: %s', $sandboxId));
                        ++$stats['error'];
                        continue;
                    }

                    // Create file lock key
                    $fileLockKey = sprintf('file_process_lock:%s', $attachment['file_key']);
                    $lockOwner = IdGenerator::getUniqueId32();
                    $lockExpireSeconds = 60;
                    $lockAcquired = false;

                    try {
                        // Attempt to acquire distributed lock
                        $lockAcquired = $this->locker->mutexLock($fileLockKey, $lockOwner, $lockExpireSeconds);

                        if (! $lockAcquired) {
                            $this->logger->warning(sprintf(
                                'Unable to acquire file processing lock, File Key: %s, Topic ID: %d, Sandbox ID: %s',
                                $attachment['file_key'],
                                $topicId,
                                $sandboxId
                            ));
                            ++$stats['error'];
                            continue;
                        }

                        $this->logger->debug(sprintf(
                            'Successfully acquired file processing lock, File Key: %s, Topic ID: %d, Lock Owner: %s',
                            $attachment['file_key'],
                            $topicId,
                            $lockOwner
                        ));

                        // Check if file already exists
                        $existingFile = $this->taskDomainService->getTaskFileByFileKey($attachment['file_key'], $topicId);
                        if ($existingFile) {
                            // If already exists, update timestamp and skip
                            $existingFile->setUpdatedAt(date('Y-m-d H:i:s'));
                            $this->taskDomainService->updateTaskFile($existingFile);

                            $this->logger->info(sprintf(
                                'Attachment already exists, updating timestamp, File Key: %s, Sandbox ID: %s',
                                $attachment['file_key'],
                                $sandboxId
                            ));
                            ++$stats['skipped'];
                            $stats['files'][] = [
                                'file_id' => $existingFile->getFileId(),
                                'file_key' => $existingFile->getFileKey(),
                                'file_name' => $existingFile->getFileName(),
                                'storage_type' => $existingFile->getStorageType(),
                                'status' => 'skipped',
                            ];
                            continue;
                        }
                        // If not exists, save it
                        $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
                            dataIsolation: $dataIsolation,
                            fileKey: $attachment['file_key'],
                            fileData: $attachment,
                            projectId: $task->getProjectId(),
                            topicId: $topicId,
                            taskId: $task->getId(),
                            fileType: $attachment['file_type'] ?? FileType::SYSTEM_AUTO_UPLOAD->value
                        );
                        ++$stats['success'];
                        $stats['files'][] = [
                            'file_id' => $taskFileEntity->getFileId(),
                            'file_key' => $taskFileEntity->getFileKey(),
                            'file_name' => $taskFileEntity->getFileName(),
                            'storage_type' => $taskFileEntity->getStorageType(),
                            'status' => 'created',
                        ];
                        $this->logger->info(sprintf(
                            'Attachment saved successfully, File Key: %s, Sandbox ID: %s, File name: %s',
                            $attachment['file_key'],
                            $sandboxId,
                            $attachment['filename'] ?? $attachment['display_filename'] ?? 'Unknown'
                        ));
                    } catch (Throwable $e) {
                        $this->logger->error(sprintf(
                            'Processing attachment exception: %s, File Key: %s, Sandbox ID: %s',
                            $e->getMessage(),
                            $attachment['file_key'],
                            $sandboxId
                        ));
                        ++$stats['error'];
                        $stats['files'][] = [
                            'file_key' => $attachment['file_key'],
                            'file_name' => $attachment['filename'] ?? $attachment['display_filename'] ?? 'Unknown',
                            'status' => 'error',
                            'error' => $e->getMessage(),
                        ];
                    } finally {
                        // Ensure lock is released
                        if ($lockAcquired) {
                            $this->locker->release($fileLockKey, $lockOwner);
                            $this->logger->debug(sprintf(
                                'Released file processing lock, File Key: %s, Topic ID: %d, Lock Owner: %s',
                                $attachment['file_key'],
                                $topicId,
                                $lockOwner
                            ));
                        }
                    }
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        'Processing attachment exception: %s, File Key: %s, Sandbox ID: %s',
                        $e->getMessage(),
                        $attachment['file_key'],
                        $sandboxId
                    ));
                    ++$stats['error'];
                    $stats['files'][] = [
                        'file_key' => $attachment['file_key'],
                        'file_name' => $attachment['filename'] ?? $attachment['display_filename'] ?? 'Unknown',
                        'status' => 'error',
                        'error' => $e->getMessage(),
                    ];
                }
            }
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        Db::commit();

        $this->logger->info(sprintf(
            'Batch attachment processing completed, Sandbox ID: %s, Processing result: Total=%d, Success=%d, Skipped=%d, Failed=%d',
            $sandboxId,
            $stats['total'],
            $stats['success'],
            $stats['skipped'],
            $stats['error']
        ));

        return $stats;
    }

    /**
     * Refresh STS Token.
     *
     * @param RefreshStsTokenRequestDTO $requestDTO Request DTO
     * @return array Refresh result
     */
    public function refreshStsToken(RefreshStsTokenRequestDTO $requestDTO): array
    {
        try {
            // Get organization code from request
            $organizationCode = $requestDTO->getOrganizationCode();

            // Get work_dir directory from task table as working directory
            $taskEntity = $this->taskDomainService->getTaskById((int) $requestDTO->getSuperMagicTaskId());
            if (empty($taskEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.not_found');
            }
            $projectDir = WorkDirectoryUtil::getRootDir($taskEntity->getUserId(), $taskEntity->getProjectId());
            // Get STS temporary credentials
            $storageType = StorageBucketType::SandBox->value;
            $expires = 3600; // Credential valid for 1 hour

            $projectEntity = $this->projectDomainService->getProjectNotUserId($taskEntity->getProjectId());

            // Create user authorization object
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);

            // Use unified FileAppService to get STS Token
            return $this->fileAppService->getStsTemporaryCredentialV2($projectEntity->getUserOrganizationCode(), $storageType, $projectDir, $expires, false);
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to refresh STS Token: %s, Organization code: %s, Sandbox ID: %s',
                $e->getMessage(),
                $requestDTO->getOrganizationCode(),
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
        $task = $this->taskDomainService->getTaskBySandboxId($requestDTO->getSandboxId());
        if (empty($task)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.not_found');
        }

        $topic = $this->topicDomainService->getTopicOnlyByChatTopicId($requestDTO->getTopicId());
        if (empty($topic)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.not_found');
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

    public function getFilesWithUrl(DataIsolation $dataIsolation, array $fileIds, $projectId): array
    {
        $taskFiles = $this->taskFileDomainService->findUserFilesByIds($fileIds, $dataIsolation->getCurrentUserId());
        $files = [];

        if (empty($taskFiles)) {
            return $files;
        }

        $projectEntity = $this->getAccessibleProject($projectId, $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        foreach ($taskFiles as $taskFile) {
            $fileLink = $this->fileAppService->getLink($dataIsolation->getCurrentOrganizationCode(), $taskFile->getFileKey(), StorageBucketType::SandBox);
            if (empty($fileLink)) {
                // If URL retrieval fails, skip
                continue;
            }
            $files[] = [
                'file_id' => $taskFile->getFileId(),
                'file_extension' => $taskFile->getFileExtension(),
                'file_key' => $taskFile->getFileKey(),
                'file_size' => $taskFile->getFileSize(),
                'filename' => $taskFile->getFileName(),
                'display_filename' => $taskFile->getFileName(),
                'file_tag' => $taskFile->getFileType(),
                'file_url' => $fileLink->getUrl(),
                'relative_file_path' => WorkDirectoryUtil::getRelativeFilePath($taskFile->getFileKey(), $projectEntity->getWorkDir()),
            ];
        }
        return $files;
    }

    public function getFilesWithMentions(DataIsolation $dataIsolation, array $mentions): array
    {
        $files = [];
        foreach ($mentions as $mention) {
            if ($mention['type'] == MentionType::PROJECT_FILE->value) {
                $files[] = $mention['file_metadata'];
            }
        }
        return $files;
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
     *
     * @param int $fileId File ID
     * @return array File basic information (file name, current version, organization code)
     */
    public function getFileInfoById(int $fileId): array
    {
        // Get file entity by ID
        $taskFileEntity = $this->taskFileDomainService->getById($fileId);

        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        // Get current version (latest version number) - optimized for performance
        $currentVersion = $this->taskFileVersionDomainService->getLatestVersionNumber($fileId);

        // Create response DTO and return
        $responseDTO = new FileInfoResponseDTO(
            $taskFileEntity->getFileName(),
            $currentVersion,
            $taskFileEntity->getOrganizationCode()
        );
        return $responseDTO->toArray();
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

        $projectEntity = $this->getAccessibleProjectWithEditor($taskFileEntity->getProjectId(), $authorization->getId(), $authorization->getOrganizationCode());

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
            $projectEntity->getUserOrganizationCode(),
            $taskFileEntity->getFileId()
        );

        // 4. Update file metadata
        $this->updateFileMetadata($taskFileEntity, $result);

        // 5. 创建文件版本
        $this->taskFileVersionDomainService->createFileVersion($projectEntity->getUserOrganizationCode(), $taskFileEntity);

        return [
            'file_id' => $requestDTO->getFileId(),
            'size' => $result['size'],
            'updated_at' => date('Y-m-d H:i:s'),
            'shadow_decoded' => $requestDTO->getEnableShadow(),
        ];
    }

    /**
     * Validate file permission.
     *
     * @param int $fileId File ID
     * @param MagicUserAuthorization $authorization User authorization
     * @return TaskFileEntity Task file entity
     */
    private function validateFilePermission(int $fileId, MagicUserAuthorization $authorization): TaskFileEntity
    {
        // Get TaskFileEntity by file_id
        $taskFileEntity = $this->taskDomainService->getTaskFile($fileId);

        if (empty($taskFileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'file.not_found');
        }

        /*// Check if current user is the file owner
        if ($taskFileEntity->getUserId() !== $authorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }*/

        $this->getAccessibleProject($taskFileEntity->getProjectId(), $authorization->getId(), $authorization->getOrganizationCode());

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
            $uploadFile = new UploadFile($tempFile, '', $uploadFileKey, false);

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
     */
    private function updateFileMetadata(TaskFileEntity $taskFileEntity, array $result): void
    {
        // Update file size and modification time
        $taskFileEntity->setFileSize($result['size']);
        $taskFileEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // Save updated entity
        $this->taskDomainService->updateTaskFile($taskFileEntity);
    }
}
