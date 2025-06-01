<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatFileAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\ShadowCode\ShadowCode;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\TaskFileType;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RefreshStsTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveFileContentRequestDTO;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\RateLimit\Annotation\RateLimit;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 文件处理应用服务
 * 负责跨域文件操作，包括查找文件是否存在以及更新和创建文件.
 */
class FileProcessAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatFileAppService $magicChatFileAppService,
        private readonly TaskDomainService $taskDomainService,
        private readonly FileAppService $fileAppService,
        private readonly LockerInterface $locker,
        private readonly FileDomainService $fileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 根据file_key查找文件是否存在，如果存在则更新，不存在则创建
     *
     * @param string $fileKey 文件key
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param array $fileData 文件数据
     * @param int $topicId 话题ID
     * @param int $taskId 任务ID
     * @param string $fileType 文件类型
     * @return array 返回任务文件实体和文件ID
     */
    public function processFileByFileKey(
        string $fileKey,
        DataIsolation $dataIsolation,
        array $fileData,
        int $topicId,
        int $taskId,
        string $fileType = TaskFileType::PROCESS->value
    ): array {
        $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
            dataIsolation: $dataIsolation,
            fileKey: $fileKey,
            fileData: $fileData,
            topicId: $topicId,
            taskId: $taskId,
            fileType: $fileType,
            isUpdate: true
        );
        return [$taskFileEntity->getFileId(), $taskFileEntity];
    }

    /**
     * 处理初始附件，将用户初始上传的附件保存到任务文件表.
     *
     * @param null|string $attachments 附件JSON字符串
     * @param TaskEntity $task 任务实体
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @return array 处理结果统计
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
                    '附件数据格式错误，任务ID: %s，原始附件数据: %s',
                    $task->getTaskId(),
                    $attachments
                ));
                return $stats;
            }

            $stats['total'] = count($attachmentsData);

            $this->logger->info(sprintf(
                '开始处理初始附件，任务ID: %s，附件数量: %d',
                $task->getTaskId(),
                $stats['total']
            ));

            // 对每个附件进行处理
            foreach ($attachmentsData as $attachment) {
                // 确保有file_id
                if (empty($attachment['file_id'])) {
                    $this->logger->warning(sprintf(
                        '附件缺少file_id，任务ID: %s，附件内容: %s',
                        $task->getTaskId(),
                        json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    ));
                    ++$stats['error'];
                    continue;
                }

                // 获取完整的文件信息
                $fileInfo = $this->magicChatFileAppService->getFileInfo($attachment['file_id']);
                if (empty($fileInfo)) {
                    $this->logger->warning(sprintf(
                        '未找到附件文件，文件ID: %s，任务ID: %s',
                        $attachment['file_id'],
                        $task->getTaskId()
                    ));
                    ++$stats['error'];
                    continue;
                }

                // 构建完整的附件信息
                $completeAttachment = [
                    'file_id' => $attachment['file_id'],
                    'file_key' => $fileInfo['file_key'],
                    'file_extension' => $fileInfo['file_extension'],
                    'filename' => $fileInfo['file_name'],
                    'display_filename' => $fileInfo['file_name'],
                    'file_size' => $fileInfo['file_size'],
                    'file_tag' => 'user_upload',
                    'file_url' => $fileInfo['external_url'] ?? '',
                    'storage_type' => $attachment['storage_type'] ?? 'workspace',
                ];

                // 处理单个附件
                try {
                    $this->processFileByFileKey(
                        $completeAttachment['file_key'],
                        $dataIsolation,
                        $completeAttachment,
                        $task->getTopicId(),
                        (int) $task->getId(),
                        'user_upload'
                    );
                    ++$stats['success'];
                } catch (Throwable $e) {
                    $this->logger->error(sprintf(
                        '处理单个初始附件失败: %s, 文件ID: %s, 任务ID: %s',
                        $e->getMessage(),
                        $completeAttachment['file_id'] ?? '未知',
                        $task->getTaskId()
                    ));
                    ++$stats['error'];
                }
            }

            $this->logger->info(sprintf(
                '初始附件处理完成，任务ID: %s，处理结果: 总数=%d，成功=%d，失败=%d',
                $task->getTaskId(),
                $stats['total'],
                $stats['success'],
                $stats['error']
            ));

            return $stats;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '处理初始附件整体失败: %s, 任务ID: %s',
                $e->getMessage(),
                $task->getTaskId()
            ));
            $stats['error'] = $stats['total'];
            return $stats;
        }
    }

    /**
     * 批量处理附件数组，根据fileKey检查是否存在，存在则跳过，不存在则保存.
     *
     * @param array $attachments 附件数组
     * @param string $sandboxId 沙箱ID
     * @param string $organizationCode 组织编码
     * @param int | null $topicId 话题ID，如果未提供将从任务记录中获取
     * @return array 处理结果统计
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

        // 创建数据隔离对象
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        $task = null;
        // 如果未提供topicId，从任务记录中获取
        if ($topicId === null) {
            $task = $this->taskDomainService->getTaskBySandboxId($sandboxId);
            if (empty($task)) {
                $this->logger->error(sprintf('无法找到任务，沙箱ID: %s', $sandboxId));
                $stats['error'] = $stats['total'];
                return $stats;
            }
            $topicId = $task->getTopicId();
        }

        $this->logger->info(sprintf(
            '开始批量处理附件，沙箱ID: %s，附件数量: %d',
            $sandboxId,
            $stats['total']
        ));
        // 对每个附件进行处理
        foreach ($attachments as $attachment) {
            // 确保有file_key
            if (empty($attachment['file_key'])) {
                $this->logger->warning(sprintf(
                    '附件缺少file_key，沙箱ID: %s，附件内容: %s',
                    $sandboxId,
                    json_encode($attachment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ));
                ++$stats['error'];
                continue;
            }
            try {
                // 确保任务存在并有ID
                if (empty($task) || empty($task->getId())) {
                    $this->logger->error(sprintf('无法找到任务或任务ID为空，沙箱ID: %s', $sandboxId));
                    ++$stats['error'];
                    continue;
                }

                // 检查文件是否已存在
                $existingFile = $this->taskDomainService->getTaskFileByFileKey($attachment['file_key']);
                if ($existingFile) {
                    // 如果已存在，记录并跳过
                    $this->logger->info(sprintf(
                        '附件已存在，跳过处理，文件Key: %s，沙箱ID: %s',
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
                // 如果不存在，则保存
                $taskFileEntity = $this->taskDomainService->saveTaskFileByFileKey(
                    dataIsolation: $dataIsolation,
                    fileKey: $attachment['file_key'],
                    fileData: $attachment,
                    topicId: $topicId,
                    taskId: $task->getId(),
                    fileType: $attachment['file_type'] ?? 'system_auto_upload'
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
                    '附件保存成功，文件Key: %s，沙箱ID: %s，文件名: %s',
                    $attachment['file_key'],
                    $sandboxId,
                    $attachment['filename'] ?? $attachment['display_filename'] ?? '未知'
                ));
            } catch (Throwable $e) {
                $this->logger->error(sprintf(
                    '处理附件异常: %s, 文件Key: %s, 沙箱ID: %s',
                    $e->getMessage(),
                    $attachment['file_key'],
                    $sandboxId
                ));
                ++$stats['error'];
                $stats['files'][] = [
                    'file_key' => $attachment['file_key'],
                    'file_name' => $attachment['filename'] ?? $attachment['display_filename'] ?? '未知',
                    'status' => 'error',
                    'error' => $e->getMessage(),
                ];
            }
        }

        $this->logger->info(sprintf(
            '附件批量处理完成，沙箱ID: %s，处理结果: 总数=%d，成功=%d，跳过=%d，失败=%d',
            $sandboxId,
            $stats['total'],
            $stats['success'],
            $stats['skipped'],
            $stats['error']
        ));

        return $stats;
    }

    /**
     * 刷新 STS Token.
     *
     * @param RefreshStsTokenRequestDTO $requestDTO 请求DTO
     * @return array 刷新结果
     */
    public function refreshStsToken(RefreshStsTokenRequestDTO $requestDTO): array
    {
        try {
            // 获取请求中的组织编码
            $organizationCode = $requestDTO->getOrganizationCode();

            // 获取 task 表中的 work_dir 目录作为工作目录
            $taskEntity = $this->taskDomainService->getTaskById((int) $requestDTO->getSuperMagicTaskId());
            if (empty($taskEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TASK_NOT_FOUND, 'task.not_found');
            }
            $workDir = $taskEntity->getWorkDir();
            if (empty($workDir)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'task.work_dir.not_found');
            }

            // 获取STS临时凭证
            $storageType = StorageBucketType::Private->value;
            $expires = 7200; // 凭证有效期2小时

            // 创建用户授权对象
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);

            // 使用统一的FileAppService获取STS Token
            return $this->fileAppService->getStsTemporaryCredential($userAuthorization, $storageType, $workDir, $expires);
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '刷新STS Token失败: %s，组织编码: %s，沙箱ID: %s',
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
    #[RateLimit(create: 30, consume: 1, capacity: 10, waitTimeout: 3)]
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
        $taskFileEntity = $this->validateFilePermission($requestDTO->getFileId(), $authorization);

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
        $result = $this->uploadFileContent($taskFileEntity, $content, $authorization);

        // 4. Update file metadata
        $this->updateFileMetadata($taskFileEntity, $result);

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

        // Check if current user is the file owner
        if ($taskFileEntity->getUserId() !== $authorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }

        return $taskFileEntity;
    }

    /**
     * Upload file content to object storage.
     *
     * @param TaskFileEntity $taskFileEntity Task file entity
     * @param string $content File content
     * @param MagicUserAuthorization $authorization User authorization
     * @return array Upload result
     */
    private function uploadFileContent(TaskFileEntity $taskFileEntity, string $content, MagicUserAuthorization $authorization): array
    {
        try {
            // Log debug information
            $this->logger->info(sprintf(
                'Starting file upload - file_id: %d, file_key: %s, file_name: %s, file_extension: %s, organization: %s, content_size: %d',
                $taskFileEntity->getFileId(),
                $taskFileEntity->getFileKey(),
                $taskFileEntity->getFileName(),
                $taskFileEntity->getFileExtension(),
                $authorization->getOrganizationCode(),
                strlen($content)
            ));

            // Step 1: Save upload content to temporary file with correct file extension
            $tempFile = tempnam(sys_get_temp_dir(), 'file_save_');

            // Ensure temporary file has correct extension
            $fileExtension = $taskFileEntity->getFileExtension();
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
            $appId = config('kk_brd_service.app_id');
            $md5Key = md5(StorageBucketType::Private->value);
            $uploadKeyPrefix = "{$authorization->getOrganizationCode()}/{$appId}";
            $uploadFileKey = str_replace($uploadKeyPrefix, '', $taskFileEntity->getFileKey());
            $uploadFile = new UploadFile($tempFile, '', $uploadFileKey, false);

            $this->logger->info(sprintf(
                'Created UploadFile object with file_key: %s',
                $uploadFile->getKey()
            ));

            // Step 3: Upload using FileDomainService uploadByCredential method
            $this->fileDomainService->uploadByCredential($authorization->getOrganizationCode(), $uploadFile, StorageBucketType::Private, false);

            $fileLink = $this->fileDomainService->getLink($authorization->getOrganizationCode(), $taskFileEntity->getFileKey(), StorageBucketType::Private);

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
                'key' => $taskFileEntity->getFileKey(), // Keep original file_key unchanged
            ];
        } catch (Throwable $e) {
            // Clean up temporary file if it exists
            if (isset($tempFile) && file_exists($tempFile)) {
                unlink($tempFile);
            }

            $this->logger->error(sprintf(
                'File upload failed: %s, file_id: %d, user_id: %s',
                $e->getMessage(),
                $taskFileEntity->getFileId(),
                $authorization->getId()
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
