<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\FileBatchCopyPublisher;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\FileBatchMovePublisher;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\ProjectFileConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\AttachmentsProcessedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchCopyEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileBatchMoveEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileMovedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileRenamedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileReplacedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileBatchOperationStatusManager;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchCopyFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchDeleteFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchMoveFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveProjectFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CheckBatchOperationStatusRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteDirectoryRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileTreeRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ReplaceFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TopicUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileBatchOperationResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\FileBatchOperationStatusResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\GetFileTreeResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function event_dispatch;
use function Hyperf\Translation\trans;

class FileManagementAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly FileAppService $fileAppService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskFileVersionDomainService $taskFileVersionDomainService,
        private readonly CloudFileRepositoryInterface $cloudFileRepository,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly FileBatchOperationStatusManager $batchOperationStatusManager,
        private readonly LockerInterface $locker,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly ProjectDomainService $projectDomainService,
        private readonly FileCollectionDomainService $fileCollectionDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 获取项目文件上传STS Token.
     *
     * @param ProjectUploadTokenRequestDTO $requestDTO Request DTO
     * @return array 获取结果
     */
    public function getProjectUploadToken(RequestContext $requestContext, ProjectUploadTokenRequestDTO $requestDTO): array
    {
        try {
            $projectId = $requestDTO->getProjectId();
            $expires = $requestDTO->getExpires();

            // 获取当前用户信息
            $userAuthorization = $requestContext->getUserAuthorization();

            // 创建数据隔离对象
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            $userId = $dataIsolation->getCurrentUserId();
            $organizationCode = $dataIsolation->getCurrentOrganizationCode();

            // 情况1：有项目ID，获取项目的work_dir
            if (! empty($projectId)) {
                $projectEntity = $this->getAccessibleProject((int) $projectId, $userId, $userAuthorization->getOrganizationCode());
                $workDir = $projectEntity->getWorkDir();
                if (empty($workDir)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
                }
                $organizationCode = $projectEntity->getUserOrganizationCode();
            } else {
                // 情况2：无项目ID，使用雪花ID生成临时项目ID
                $tempProjectId = IdGenerator::getSnowId();
                $workDir = WorkDirectoryUtil::getWorkDir($userId, $tempProjectId);
            }

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::SandBox->value;

            return $this->fileAppService->getStsTemporaryCredentialV2(
                $organizationCode,
                $storageType,
                $workDir,
                $expires,
                false,
            );
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in get project upload token: %s, Project ID: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in get project upload token: %s, Project ID: %s',
                $e->getMessage(),
                $requestDTO->getProjectId()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, trans('system.upload_token_failed'));
        }
    }

    /**
     * 获取话题文件上传STS Token.
     *
     * @param RequestContext $requestContext Request context
     * @param TopicUploadTokenRequestDTO $requestDTO Request DTO
     * @return array 获取结果
     */
    public function getTopicUploadToken(RequestContext $requestContext, TopicUploadTokenRequestDTO $requestDTO): array
    {
        try {
            $topicId = $requestDTO->getTopicId();
            $expires = $requestDTO->getExpires();

            // 获取当前用户信息
            $userAuthorization = $requestContext->getUserAuthorization();

            // 创建数据隔离对象
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            $userId = $dataIsolation->getCurrentUserId();
            $organizationCode = $dataIsolation->getCurrentOrganizationCode();

            // 生成话题工作目录
            $topicEntity = $this->topicDomainService->getTopicById((int) $topicId);
            if (empty($topicEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, trans('topic.not_found'));
            }
            $projectEntity = $this->projectDomainService->getProjectNotUserId($topicEntity->getProjectId());
            $workDir = WorkDirectoryUtil::getTopicUploadDir($userId, $topicEntity->getProjectId(), $topicEntity->getId());

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::SandBox->value;

            return $this->fileAppService->getStsTemporaryCredentialV2(
                $projectEntity->getUserOrganizationCode(),
                $storageType,
                $workDir,
                $expires,
            );
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in get topic upload token: %s, Topic ID: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getTopicId(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in get topic upload token: %s, Topic ID: %s',
                $e->getMessage(),
                $requestDTO->getTopicId()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, trans('system.upload_token_failed'));
        }
    }

    /**
     * 保存项目文件.
     *
     * @param RequestContext $requestContext Request context
     * @param SaveProjectFileRequestDTO $requestDTO Request DTO
     * @return array 保存结果
     */
    public function saveFile(RequestContext $requestContext, SaveProjectFileRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 构建锁名称 - 基于项目ID和相对目录路径
        $projectId = $requestDTO->getProjectId();
        $fileKey = $requestDTO->getFileKey();

        // 校验项目归属权限并获取工作目录 - 需要先获取项目信息
        $projectEntity = $this->getAccessibleProjectWithEditor((int) $requestDTO->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

        $lockName = WorkDirectoryUtil::getLockerKey($projectEntity->getId());
        $lockOwner = $dataIsolation->getCurrentUserId();

        // 获取自旋锁（30秒超时）
        if (! $this->locker->spinLock($lockName, $lockOwner, 30)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_SAVE_FAILED,
                trans('file.directory_creation_locked')
            );
        }

        if (empty($requestDTO->getFileKey())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('validation.file_key_required'));
        }

        if (empty($requestDTO->getFileName())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('validation.file_name_required'));
        }

        Db::beginTransaction();
        try {
            if (empty($requestDTO->getParentId())) {
                $parentId = $this->taskFileDomainService->findOrCreateDirectoryAndGetParentId(
                    projectId: (int) $projectId,
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                    fullFileKey: $requestDTO->getFileKey(),
                    workDir: $projectEntity->getWorkDir(),
                );
                $requestDTO->setParentId((string) $parentId);
            } else {
                $parentFileEntity = $this->taskFileDomainService->getById((int) $requestDTO->getParentId());
                if (empty($parentFileEntity) || $parentFileEntity->getProjectId() != (int) $projectId) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.not_found'));
                }
            }

            // 创建 TaskFileEntity 实体
            $taskFileEntity = $requestDTO->toEntity();

            // 通过领域服务计算排序值
            $sortValue = $this->taskFileDomainService->calculateSortForNewFile(
                ! empty($requestDTO->getParentId()) ? (int) $requestDTO->getParentId() : null,
                (int) $requestDTO->getPreFileId(),
                (int) $requestDTO->getProjectId()
            );

            // 设置排序值
            $taskFileEntity->setSort($sortValue);

            // 调用领域服务保存文件
            $savedEntity = $this->taskFileDomainService->saveProjectFile(
                $dataIsolation,
                $projectEntity,
                $taskFileEntity,
                StorageType::WORKSPACE->value
            );

            Db::commit();

            // 发布文件已上传事件
            $fileUploadedEvent = new FileUploadedEvent($taskFileEntity, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
            $this->eventDispatcher->dispatch($fileUploadedEvent);

            // 返回保存结果
            return TaskFileItemDTO::fromEntity($savedEntity, $projectEntity->getWorkDir())->toArray();
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            Db::rollBack();
            $this->logger->warning(sprintf(
                'Business logic error in save file: %s, Project ID: %s, File Key: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileKey(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error(sprintf(
                'System error in save project file: %s, Project ID: %s, File Key: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileKey()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, trans('file.file_save_failed'));
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 批量保存项目文件（同一目录下）.
     *
     * @param RequestContext $requestContext Request context
     * @param BatchSaveProjectFilesRequestDTO $requestDTO Batch save request DTO
     * @return array 批量保存结果，返回文件ID数组
     */
    public function batchSaveFiles(RequestContext $requestContext, BatchSaveProjectFilesRequestDTO $requestDTO): array
    {
        $files = $requestDTO->getFiles();

        if (empty($files)) {
            return [];
        }

        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $projectId = (int) $requestDTO->getProjectId();

        // 项目级别锁
        $lockName = WorkDirectoryUtil::getLockerKey($projectId);
        $lockOwner = $userAuthorization->getId();

        // 获取项目级别的锁（30秒超时）
        if (! $this->locker->spinLock($lockName, $lockOwner, 30)) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_SAVE_FAILED,
                trans('file.batch_save_locked')
            );
        }

        // 1. 验证项目权限
        $projectEntity = $this->getAccessibleProjectWithEditor($projectId, $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        Db::beginTransaction();
        try {
            // 3. 批量保存文件
            $savedFileIds = [];
            $savedEntities = []; // Store entities for metadata file check
            foreach ($files as $fileData) {
                try {
                    // 基础参数验证
                    if (empty($fileData['file_key']) || empty($fileData['file_name'])) {
                        continue;
                    }

                    // 创建 SaveProjectFileRequestDTO
                    $fileData['project_id'] = (string) $projectEntity->getId();
                    $fileData['parent_id'] = '';
                    $requestDTO = SaveProjectFileRequestDTO::fromRequest($fileData);

                    // 创建文件实体
                    $taskFileEntity = $requestDTO->toEntity();

                    // 保存文件（不设置排序值）
                    $savedEntity = $this->taskFileDomainService->saveProjectFile(
                        $dataIsolation,
                        $projectEntity,
                        $taskFileEntity,
                        StorageType::WORKSPACE->value
                    );

                    $savedFileIds[] = TaskFileItemDTO::fromEntity($savedEntity, $projectEntity->getWorkDir());
                    $savedEntities[] = $savedEntity; // Store entity for later check
                } catch (Throwable $e) {
                    $this->logger->warning(sprintf(
                        'Single file save failed in batch: %s, File: %s, Error: %s',
                        $fileData['file_key'] ?? 'unknown',
                        $fileData['file_name'] ?? 'unknown',
                        $e->getMessage()
                    ));
                    // 单个文件失败不影响其他文件，继续处理下一个
                }
            }
            Db::commit();

            // 4. Check if any saved files are metadata files and trigger event once
            foreach ($savedEntities as $savedEntity) {
                if ($savedEntity !== null && ProjectFileConstant::isSetMetadataFile($savedEntity->getFileName())) {
                    event_dispatch(new AttachmentsProcessedEvent(
                        $savedEntity->getParentId(),
                        $savedEntity->getProjectId(),
                        $savedEntity->getTaskId()
                    ));
                    $this->logger->info(sprintf(
                        'Dispatched AttachmentsProcessedEvent for batch save after all files saved, parentId: %d, projectId: %d, taskId: %d',
                        $savedEntity->getParentId(),
                        $savedEntity->getProjectId(),
                        $savedEntity->getTaskId()
                    ));
                    break; // Only trigger once
                }
            }

            return $savedFileIds;
        } catch (BusinessException $e) {
            Db::rollBack();
            $this->logger->warning(sprintf(
                'Business logic error in batch save files: %s, Project ID: %s, Error Code: %d',
                $e->getMessage(),
                $projectId,
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error(sprintf(
                'System error in batch save files: %s, Project ID: %s',
                $e->getMessage(),
                $projectId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, trans('file.batch_save_failed'));
        } finally {
            // 确保释放锁
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 创建文件或文件夹.
     *
     * @param RequestContext $requestContext Request context
     * @param CreateFileRequestDTO $requestDTO Request DTO
     * @return array 创建结果
     */
    public function createFile(RequestContext $requestContext, CreateFileRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        Db::beginTransaction();
        try {
            $projectId = (int) $requestDTO->getProjectId();
            $parentId = ! empty($requestDTO->getParentId()) ? (int) $requestDTO->getParentId() : 0;

            // 校验项目归属权限 - 确保用户只能在自己的项目中创建文件
            $projectEntity = $this->getAccessibleProjectWithEditor($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

            // 如果 parent_id 为空，则设置为根目录
            if (empty($parentId)) {
                $parentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $projectId,
                    workDir: $projectEntity->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $projectEntity->getUserOrganizationCode()
                );
            }

            // 通过领域服务计算排序值
            $sortValue = $this->taskFileDomainService->calculateSortForNewFile(
                $parentId === 0 ? null : $parentId,
                (int) $requestDTO->getPreFileId(),
                $projectId
            );

            // 调用领域服务创建文件或文件夹
            $taskFileEntity = $this->taskFileDomainService->createProjectFile(
                $dataIsolation,
                $projectEntity,
                $parentId,
                $requestDTO->getFileName(),
                $requestDTO->getIsDirectory(),
                $sortValue
            );

            Db::commit();

            // 发布文件已上传事件
            $fileUploadedEvent = new FileUploadedEvent($taskFileEntity, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
            $this->eventDispatcher->dispatch($fileUploadedEvent);

            // 返回创建结果
            return TaskFileItemDTO::fromEntity($taskFileEntity, $projectEntity->getWorkDir())->toArray();
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            Db::rollBack();
            $this->logger->warning(sprintf(
                'Business logic error in create file: %s, Project ID: %s, File Name: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileName(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error(sprintf(
                'System error in create file: %s, Project ID: %s, File Name: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileName()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_CREATE_FAILED, trans('file.file_create_failed'));
        }
    }

    public function deleteFile(RequestContext $requestContext, int $fileId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $fileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($fileId);
            $projectEntity = $this->getAccessibleProjectWithEditor($fileEntity->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
            if ($fileEntity->getIsDirectory()) {
                $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles($dataIsolation, $projectEntity->getWorkDir(), $projectEntity->getId(), $fileEntity->getFileKey(), $projectEntity->getUserOrganizationCode());
                // 发布目录已删除事件
                $directoryDeletedEvent = new DirectoryDeletedEvent($fileEntity, $userAuthorization);
                $this->eventDispatcher->dispatch($directoryDeletedEvent);
            } else {
                $deletedCount = 1;
                $this->taskFileDomainService->deleteProjectFiles($projectEntity->getUserOrganizationCode(), $fileEntity, $projectEntity->getWorkDir());
                // 发布文件已删除事件
                $fileDeletedEvent = new FileDeletedEvent($fileEntity, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());
                $this->eventDispatcher->dispatch($fileDeletedEvent);
            }
            return ['file_id' => $fileId, 'count' => $deletedCount];
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in delete file: %s, File ID: %s, Error Code: %d',
                $e->getMessage(),
                $fileId,
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in delete project file: %s, File ID: %s',
                $e->getMessage(),
                $fileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.file_delete_failed'));
        }
    }

    public function deleteDirectory(RequestContext $requestContext, DeleteDirectoryRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userId = $dataIsolation->getCurrentUserId();

        try {
            $projectId = (int) $requestDTO->getProjectId();
            $fileId = $requestDTO->getFileId();

            // 1. 验证项目是否属于当前用户
            $projectEntity = $this->getAccessibleProjectWithEditor($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

            // 2. 获取工作目录并拼接完整路径
            $workDir = $projectEntity->getWorkDir();
            if (empty($workDir)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
            }

            $fileEntity = $this->taskFileDomainService->getById((int) $fileId);
            if (empty($fileEntity) || $fileEntity->getProjectId() != $projectId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }

            // 3. 构建目标删除路径
            $targetPath = $fileEntity->getFileKey();

            // 4. 调用领域服务执行批量删除
            $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles($dataIsolation, $workDir, $projectId, $targetPath, $projectEntity->getUserOrganizationCode());

            // 发布目录已删除事件
            $directoryDeletedEvent = new DirectoryDeletedEvent($fileEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($directoryDeletedEvent);

            $this->logger->info(sprintf(
                'Successfully deleted directory: Project ID: %s, Path: %s, Deleted files: %d',
                $projectId,
                $targetPath,
                $deletedCount
            ));

            return [
                'project_id' => $projectId,
                'deleted_count' => $deletedCount,
            ];
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in delete directory: %s, Project ID: %s, File ID: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileId(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in delete directory: %s, Project ID: %s, File ID: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileId()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.directory_delete_failed'));
        }
    }

    public function batchDeleteFiles(RequestContext $requestContext, BatchDeleteFilesRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $projectId = (int) $requestDTO->getProjectId();
            $fileIds = $requestDTO->getFileIds();
            $forceDelete = $requestDTO->getForceDelete();

            // Validate project ownership
            $projectEntity = $this->getAccessibleProjectWithEditor($projectId, $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

            // Call domain service to batch delete files
            $result = $this->taskFileDomainService->batchDeleteProjectFiles(
                $dataIsolation,
                $projectEntity->getWorkDir(),
                $projectId,
                $fileIds,
                $forceDelete,
                $projectEntity->getUserOrganizationCode()
            );

            $this->logger->info(sprintf(
                'Successfully batch deleted files: Project ID: %s, File count: %d',
                $projectId,
                count($fileIds)
            ));

            // 发布文件已上传事件
            $fileUploadedEvent = new FilesBatchDeletedEvent((int) $requestDTO->getProjectId(), $requestDTO->getFileIds(), $userAuthorization);
            $this->eventDispatcher->dispatch($fileUploadedEvent);

            return $result;
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in batch delete files: %s, Project ID: %s, File IDs: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                implode(',', $requestDTO->getFileIds()),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in batch delete files: %s, Project ID: %s, File IDs: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                implode(',', $requestDTO->getFileIds())
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.batch_delete_failed'));
        }
    }

    public function renameFile(RequestContext $requestContext, int $fileId, string $targetName): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $fileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($fileId);
            $projectEntity = $this->getAccessibleProjectWithEditor($fileEntity->getProjectId(), $userAuthorization->getId(), $userAuthorization->getOrganizationCode());

            if ($fileEntity->getIsDirectory()) {
                // Directory rename: batch process all sub-files
                $renamedCount = $this->taskFileDomainService->renameDirectoryFiles(
                    $dataIsolation,
                    $fileEntity,
                    $projectEntity,
                    $targetName
                );
                // Get the updated entity after rename
                $newFileEntity = $this->taskFileDomainService->getById($fileId);
            } else {
                // Single file rename: use existing method
                $newFileEntity = $this->taskFileDomainService->renameProjectFile($dataIsolation, $fileEntity, $projectEntity, $targetName);
            }

            // 发布文件已重命名事件
            $fileRenamedEvent = new FileRenamedEvent($newFileEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($fileRenamedEvent);

            return TaskFileItemDTO::fromEntity($newFileEntity, $projectEntity->getWorkDir())->toArray();
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in rename file: %s, File ID: %s, Error Code: %d',
                $e->getMessage(),
                $fileId,
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in rename project file: %s, File ID: %s',
                $e->getMessage(),
                $fileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_RENAME_FAILED, trans('file.file_rename_failed'));
        }
    }

    /**
     * Move file to target directory (supports both same-project and cross-project move).
     *
     * @param RequestContext $requestContext Request context
     * @param int $fileId File ID to move
     * @param int $targetParentId Target parent directory ID
     * @param null|int $preFileId Previous file ID for positioning
     * @param null|int $targetProjectId Target project ID (null means same project)
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     * @return array Move result
     */
    public function moveFile(
        RequestContext $requestContext,
        int $fileId,
        int $targetParentId,
        ?int $preFileId = null,
        ?int $targetProjectId = null,
        array $keepBothFileIds = []
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. Get source file entity
            $fileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($fileId);

            // 2. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                $fileEntity->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            // 3. Get target project (if not provided, use source project)
            $targetProject = $targetProjectId
                ? $this->getAccessibleProjectWithEditor(
                    $targetProjectId,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
                : $sourceProject;

            // 4. Handle target parent directory
            if (empty($targetParentId)) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $targetProject->getId(),
                    workDir: $targetProject->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $targetProject->getUserOrganizationCode()
                );
            }

            // 5. Directory move: use asynchronous processing
            if ($fileEntity->getIsDirectory()) {
                $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                    FileBatchOperationStatusManager::OPERATION_MOVE,
                    $dataIsolation->getCurrentUserId(),
                    (string) $fileEntity->getFileId()
                );

                // Initialize task status
                $this->batchOperationStatusManager->initializeTask(
                    $batchKey,
                    FileBatchOperationStatusManager::OPERATION_MOVE,
                    $dataIsolation->getCurrentUserId(),
                    1
                );

                // Publish move event
                $fileIds = $this->taskFileDomainService->getDirectoryFileIds($dataIsolation, $fileEntity);
                $event = FileBatchMoveEvent::fromDTO(
                    $batchKey,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $fileIds,
                    $targetProject->getId(),
                    $sourceProject->getId(),
                    $preFileId,
                    $targetParentId,
                    $keepBothFileIds
                );

                $this->logger->info(sprintf('Move directory request data, batchKey: %s', $batchKey), [
                    'file_ids' => $fileIds,
                    'source_project_id' => $sourceProject->getId(),
                    'target_project_id' => $targetProject->getId(),
                    'target_parent_id' => $targetParentId,
                    'pre_file_id' => $preFileId,
                    'keep_both_file_ids' => $keepBothFileIds,
                ]);

                $publisher = new FileBatchMovePublisher($event);
                $this->producer->produce($publisher);

                // Return asynchronous response
                return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
            }

            // 6. Single file sync move
            // Handle file path update if needed
            $originalParentId = $fileEntity->getParentId();
            $needUpdatePath = ($sourceProject->getId() !== $targetProject->getId())
                           || ($originalParentId !== $targetParentId);

            if ($needUpdatePath) {
                $this->taskFileDomainService->moveProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $sourceProject,
                    $targetProject,
                    $targetParentId,
                    $keepBothFileIds
                );
            }

            // 7. Handle file sorting in target project
            $this->taskFileDomainService->handleFileSortOnMove(
                $fileEntity,
                $targetProject,
                $targetParentId,
                $preFileId
            );

            // 8. Re-get file entity with updated data
            $newFileEntity = $this->taskFileDomainService->getById($fileId);

            // 9. Dispatch file moved event
            $fileMovedEvent = new FileMovedEvent($newFileEntity, $userAuthorization);
            $this->eventDispatcher->dispatch($fileMovedEvent);

            $result = TaskFileItemDTO::fromEntity($newFileEntity)->toArray();
            return FileBatchOperationResponseDTO::createSyncSuccess($result)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in move file', [
                'file_id' => $fileId,
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in move file', [
                'file_id' => $fileId,
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_MOVE_FAILED, trans('file.file_move_failed'));
        }
    }

    /**
     * Copy file to target directory (supports both same-project and cross-project copy).
     *
     * @param RequestContext $requestContext Request context
     * @param int $fileId File ID to copy
     * @param int $targetParentId Target parent directory ID
     * @param null|int $preFileId Previous file ID for positioning
     * @param null|int $targetProjectId Target project ID (null means same project)
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     * @return array Copy result
     */
    public function copyFile(
        RequestContext $requestContext,
        int $fileId,
        int $targetParentId,
        ?int $preFileId = null,
        ?int $targetProjectId = null,
        array $keepBothFileIds = []
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. Get source file entity
            $fileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($fileId);

            // 2. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                $fileEntity->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            // 3. Get target project (if not provided, use source project)
            $targetProject = $targetProjectId
                ? $this->getAccessibleProjectWithEditor(
                    $targetProjectId,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
                : $sourceProject;

            // 4. Handle target parent directory
            if (empty($targetParentId)) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $targetProject->getId(),
                    workDir: $targetProject->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $targetProject->getUserOrganizationCode()
                );
            }

            // 5. Directory copy: use asynchronous processing
            if ($fileEntity->getIsDirectory()) {
                $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                    FileBatchOperationStatusManager::OPERATION_COPY,
                    $dataIsolation->getCurrentUserId(),
                    (string) $fileEntity->getFileId()
                );

                // Initialize task status
                $this->batchOperationStatusManager->initializeTask(
                    $batchKey,
                    FileBatchOperationStatusManager::OPERATION_COPY,
                    $dataIsolation->getCurrentUserId(),
                    1
                );

                // Publish copy event
                $fileIds = $this->taskFileDomainService->getDirectoryFileIds($dataIsolation, $fileEntity);
                $event = FileBatchCopyEvent::fromDTO(
                    $batchKey,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $fileIds,
                    $targetProject->getId(),
                    $sourceProject->getId(),
                    $preFileId,
                    $targetParentId,
                    $keepBothFileIds
                );

                $this->logger->info(sprintf('Copy directory request data, batchKey: %s', $batchKey), [
                    'file_ids' => $fileIds,
                    'source_project_id' => $sourceProject->getId(),
                    'target_project_id' => $targetProject->getId(),
                    'target_parent_id' => $targetParentId,
                    'pre_file_id' => $preFileId,
                    'keep_both_file_ids' => $keepBothFileIds,
                ]);

                $publisher = new FileBatchCopyPublisher($event);
                $this->producer->produce($publisher);

                // Return asynchronous response
                return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
            }

            // 6. Single file sync copy
            $newFileEntity = $this->taskFileDomainService->copyProjectFile(
                $dataIsolation,
                $fileEntity,
                $sourceProject,
                $targetProject,
                $targetParentId,
                $keepBothFileIds
            );

            // 7. Handle file sorting in target project
            $this->taskFileDomainService->handleFileSortOnCopy(
                $newFileEntity,
                $targetProject,
                $targetParentId,
                $preFileId
            );

            // 8. Re-get file entity with updated data
            $newFileEntity = $this->taskFileDomainService->getById($newFileEntity->getFileId());

            $result = TaskFileItemDTO::fromEntity($newFileEntity)->toArray();
            return FileBatchOperationResponseDTO::createSyncSuccess($result)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in copy file', [
                'file_id' => $fileId,
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in copy file', [
                'file_id' => $fileId,
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_COPY_FAILED, trans('file.file_copy_failed'));
        }
    }

    /**
     * Get file URLs for multiple files.
     *
     * @param RequestContext $requestContext Request context
     * @param string $projectId Project ID
     * @param array $fileIds Array of file IDs
     * @param string $downloadMode Download mode (download, preview)
     * @param array $options Additional options
     * @return array File URLs
     */
    public function getFileUrls(RequestContext $requestContext, string $projectId, array $fileIds, string $downloadMode, array $options = [], array $fileVersions = []): array
    {
        try {
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            // 兼容前端传 project id 的错误问题
            //            if (count($fileIds) > 0) {
            //                $taskFileEntity = $this->taskFileDomainService->getById((int) $fileIds[0]);
            //                $projectId = $taskFileEntity?->getProjectId() ?? (int) $projectId;
            //            }

            $projectEntity = $this->getAccessibleProject((int) $projectId, $dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

            return $this->taskFileDomainService->getFileUrls(
                $projectEntity->getUserOrganizationCode(),
                $projectEntity->getId(),
                $fileIds,
                $downloadMode,
                $options,
                $fileVersions,
                true
            );
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business logic error in get file URLs: %s, File IDs: %s, Download Mode: %s, Error Code: %d',
                $e->getMessage(),
                implode(',', $fileIds),
                $downloadMode,
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in get file URLs: %s, File IDs: %s, Download Mode: %s',
                $e->getMessage(),
                implode(',', $fileIds),
                $downloadMode
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.get_urls_failed'));
        }
    }

    /**
     * Get file URLs by access token.
     *
     * @param array $fileIds Array of file IDs
     * @param string $accessToken Access token for verification
     * @param string $downloadMode Download mode (download, preview)
     * @param array $fileVersions File version mapping [新增参数]
     * @return array File URLs
     */
    public function getFileUrlsByAccessToken(array $fileIds, string $accessToken, string $downloadMode, array $fileVersions = []): array
    {
        try {
            // 从缓存里获取数据
            if (! AccessTokenUtil::validate($accessToken)) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
            }

            // 从token获取内容
            $shareId = AccessTokenUtil::getShareId($accessToken);
            $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
            if (! $shareEntity) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
            }

            $projectId = 0;
            switch ($shareEntity->getResourceType()) {
                case ResourceType::Topic->value:
                    $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                    if (empty($topicEntity)) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                    }
                    $projectId = $topicEntity->getProjectId();
                    break;
                case ResourceType::Project->value:
                    $projectId = (int) $shareEntity->getProjectId();
                    break;
                case ResourceType::FileCollection->value:
                    // 当分享的是文件集时，resource_id 是文件集ID
                    $collectionId = (int) $shareEntity->getResourceId();
                    $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                    if (empty($projectId)) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                    }
                    break;
                case ResourceType::File->value:
                    // 单文件类型：resource_id 是文件集ID（单文件也使用文件集存储）
                    $collectionId = (int) $shareEntity->getResourceId();
                    $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                    if (empty($projectId)) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                    }
                    break;
                default:
                    ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
            }

            return $this->taskFileDomainService->getFileUrlsByProjectId($fileIds, $projectId, $downloadMode, $fileVersions);
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business logic error in get file URLs by token: %s, File IDs: %s, Download Mode: %s, Error Code: %d',
                $e->getMessage(),
                implode(',', $fileIds),
                $downloadMode,
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in get file URLs by token: %s, File IDs: %s, Download Mode: %s',
                $e->getMessage(),
                implode(',', $fileIds),
                $downloadMode
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.get_urls_by_token_failed'));
        }
    }

    /**
     * Get file URLs by relative paths (user authentication).
     *
     * @param RequestContext $requestContext Request context
     * @param string $projectId Project ID
     * @param string $parentFileId Parent file ID
     * @param array $relativeFilePaths Relative file paths
     * @param string $downloadMode Download mode
     * @return array File URLs
     */
    public function getFileUrlsByPath(
        RequestContext $requestContext,
        string $projectId,
        string $parentFileId,
        array $relativeFilePaths,
        string $downloadMode
    ): array {
        try {
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            // 1. Permission check: verify project access
            $projectEntity = $this->getAccessibleProject(
                (int) $projectId,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            // 2. Verify parent_file_id belongs to this project
            $parentFileEntity = $this->taskFileDomainService->getById((int) $parentFileId);
            if (empty($parentFileEntity) || $parentFileEntity->getProjectId() !== (int) $projectId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
            }

            // 3. Call domain service to get file URLs
            return $this->taskFileDomainService->getFileUrlsByRelativePaths(
                $projectEntity->getUserOrganizationCode(),
                (int) $projectId,
                $parentFileEntity,
                $relativeFilePaths,
                $downloadMode
            );
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business error in getFileUrlsByPath: %s, project_id: %s, parent_file_id: %s',
                $e->getMessage(),
                $projectId,
                $parentFileId
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in getFileUrlsByPath: %s, project_id: %s, parent_file_id: %s',
                $e->getMessage(),
                $projectId,
                $parentFileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.get_urls_by_path_failed'));
        }
    }

    /**
     * Get file URLs by relative paths with access token (share scenarios).
     *
     * @param string $projectId Project ID
     * @param string $parentFileId Parent file ID
     * @param array $relativeFilePaths Relative file paths
     * @param string $accessToken Access token
     * @param string $downloadMode Download mode
     * @return array File URLs
     */
    public function getFileUrlsByPathWithToken(
        string $projectId,
        string $parentFileId,
        array $relativeFilePaths,
        string $accessToken,
        string $downloadMode
    ): array {
        try {
            // 1. Validate token
            if (! AccessTokenUtil::validate($accessToken)) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
            }

            // 2. Get share info from token and validate project permission
            $shareId = AccessTokenUtil::getShareId($accessToken);
            $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
            if (! $shareEntity) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
            }

            // 3. Validate share resource project ID matches request project ID
            $shareProjectId = $this->getProjectIdFromShare($shareEntity);
            if ($shareProjectId !== (int) $projectId) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.project_mismatch');
            }

            // 4. Get project entity
            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if (empty($projectEntity)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.not_found'));
            }

            // 5. Verify parent_file_id belongs to this project
            $parentFileEntity = $this->taskFileDomainService->getById((int) $parentFileId);
            if (empty($parentFileEntity) || $parentFileEntity->getProjectId() !== (int) $projectId) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
            }

            // 6. Call domain service to get file URLs
            return $this->taskFileDomainService->getFileUrlsByRelativePaths(
                $projectEntity->getUserOrganizationCode(),
                (int) $projectId,
                $parentFileEntity,
                $relativeFilePaths,
                $downloadMode
            );
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business error in getFileUrlsByPathWithToken: %s, project_id: %s, parent_file_id: %s',
                $e->getMessage(),
                $projectId,
                $parentFileId
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in getFileUrlsByPathWithToken: %s, project_id: %s, parent_file_id: %s',
                $e->getMessage(),
                $projectId,
                $parentFileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.get_urls_by_path_failed'));
        }
    }

    /**
     * Batch move files.
     *
     * @param RequestContext $requestContext Request context
     * @param BatchMoveFileRequestDTO $requestDTO Request DTO
     * @return array Batch move result
     */
    public function batchMoveFile(RequestContext $requestContext, BatchMoveFileRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                (int) $requestDTO->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            // 2. Get target project (if not provided, use source project)
            $targetProject = ! empty($requestDTO->getTargetProjectId())
                ? $this->getAccessibleProjectWithEditor(
                    (int) $requestDTO->getTargetProjectId(),
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
                : $sourceProject;

            // Generate batch key for tracking
            $fileIds = $requestDTO->getFileIds();
            sort($fileIds); // Ensure consistent hash for same file IDs
            $fileIdsHash = md5(implode(',', $fileIds));
            $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                FileBatchOperationStatusManager::OPERATION_MOVE,
                $dataIsolation->getCurrentUserId(),
                $fileIdsHash
            );

            // Expand directory file IDs to include all nested files
            $expandedFileIds = $this->expandDirectoryFileIds(
                $dataIsolation,
                $requestDTO->getFileIds(),
                $sourceProject->getId()
            );

            $this->logger->info('Expanded directory file IDs for batch move', [
                'batch_key' => $batchKey,
                'original_file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'original_count' => count($requestDTO->getFileIds()),
                'expanded_count' => count($expandedFileIds),
            ]);

            // Initialize task status with expanded file count
            $this->batchOperationStatusManager->initializeTask(
                $batchKey,
                FileBatchOperationStatusManager::OPERATION_MOVE,
                $dataIsolation->getCurrentUserId(),
                count($expandedFileIds)
            );

            // Print request data
            $this->logger->info(sprintf('Batch move file request data, batchKey: %s', $batchKey), [
                'file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'pre_file_id' => $requestDTO->getPreFileId(),
                'keep_both_file_ids' => $requestDTO->getKeepBothFileIds(),
            ]);

            // Create and publish batch move event
            $preFileId = ! empty($requestDTO->getPreFileId()) ? (int) $requestDTO->getPreFileId() : null;
            if (empty($requestDTO->getTargetParentId())) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $targetProject->getId(),
                    workDir: $targetProject->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $targetProject->getUserOrganizationCode()
                );
            } else {
                $targetParentId = (int) $requestDTO->getTargetParentId();
            }
            $event = FileBatchMoveEvent::fromDTO(
                $batchKey,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $expandedFileIds,
                $targetProject->getId(),
                $sourceProject->getId(),
                $preFileId,
                $targetParentId,
                $requestDTO->getKeepBothFileIds()
            );
            $publisher = new FileBatchMovePublisher($event);
            $this->producer->produce($publisher);
            $this->eventDispatcher->dispatch($event);

            // Return asynchronous response
            return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in batch move file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in batch move file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_MOVE_FAILED, trans('file.batch_move_failed'));
        }
    }

    /**
     * Batch copy files to target directory (supports both same-project and cross-project copy).
     *
     * @param RequestContext $requestContext Request context
     * @param BatchCopyFileRequestDTO $requestDTO Request DTO
     * @return array Batch copy result
     */
    public function batchCopyFile(RequestContext $requestContext, BatchCopyFileRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                (int) $requestDTO->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            // 2. Get target project (if not provided, use source project)
            $targetProject = ! empty($requestDTO->getTargetProjectId())
                ? $this->getAccessibleProjectWithEditor(
                    (int) $requestDTO->getTargetProjectId(),
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
                : $sourceProject;

            // Generate batch key for tracking
            $fileIds = $requestDTO->getFileIds();
            sort($fileIds); // Ensure consistent hash for same file IDs
            $fileIdsHash = md5(implode(',', $fileIds));
            $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                FileBatchOperationStatusManager::OPERATION_COPY,
                $dataIsolation->getCurrentUserId(),
                $fileIdsHash
            );

            // Expand directory file IDs to include all nested files
            $expandedFileIds = $this->expandDirectoryFileIds(
                $dataIsolation,
                $requestDTO->getFileIds(),
                $sourceProject->getId()
            );

            $this->logger->info('Expanded directory file IDs for batch copy', [
                'batch_key' => $batchKey,
                'original_file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'original_count' => count($requestDTO->getFileIds()),
                'expanded_count' => count($expandedFileIds),
            ]);

            // Initialize task status with expanded file count
            $this->batchOperationStatusManager->initializeTask(
                $batchKey,
                FileBatchOperationStatusManager::OPERATION_COPY,
                $dataIsolation->getCurrentUserId(),
                count($expandedFileIds)
            );

            // Print request data
            $this->logger->info(sprintf('Batch copy file request data, batchKey: %s', $batchKey), [
                'file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'pre_file_id' => $requestDTO->getPreFileId(),
                'keep_both_file_ids' => $requestDTO->getKeepBothFileIds(),
            ]);

            // Create and publish batch copy event
            $preFileId = ! empty($requestDTO->getPreFileId()) ? (int) $requestDTO->getPreFileId() : null;
            if (empty($requestDTO->getTargetParentId())) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $targetProject->getId(),
                    workDir: $targetProject->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $targetProject->getUserOrganizationCode()
                );
            } else {
                $targetParentId = (int) $requestDTO->getTargetParentId();
            }
            $event = FileBatchCopyEvent::fromDTO(
                $batchKey,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $expandedFileIds,
                $targetProject->getId(),
                $sourceProject->getId(),
                $preFileId,
                $targetParentId,
                $requestDTO->getKeepBothFileIds()
            );
            $publisher = new FileBatchCopyPublisher($event);
            $this->producer->produce($publisher);

            // Return asynchronous response
            return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in batch copy file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in batch copy file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => isset($sourceProject) ? $sourceProject->getId() : null,
                'target_project_id' => isset($targetProject) ? $targetProject->getId() : null,
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_COPY_FAILED, trans('file.batch_copy_failed'));
        }
    }

    /**
     * Check batch operation status.
     *
     * @param RequestContext $requestContext Request context
     * @param CheckBatchOperationStatusRequestDTO $requestDTO Request DTO
     * @return FileBatchOperationStatusResponseDTO Response DTO
     */
    public function checkBatchOperationStatus(
        RequestContext $requestContext,
        CheckBatchOperationStatusRequestDTO $requestDTO
    ): FileBatchOperationStatusResponseDTO {
        try {
            $batchKey = $requestDTO->getBatchKey();
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            // Verify user permission for this batch operation
            if (! $this->batchOperationStatusManager->verifyUserPermission($batchKey, $dataIsolation->getCurrentUserId())) {
                $this->logger->warning('User permission denied for batch operation status check', [
                    'batch_key' => $batchKey,
                    'user_id' => $dataIsolation->getCurrentUserId(),
                ]);
                return FileBatchOperationStatusResponseDTO::createNotFound();
            }

            // Get task status from Redis
            $taskStatus = $this->batchOperationStatusManager->getTaskStatus($batchKey);

            if (! $taskStatus) {
                $this->logger->info('Batch operation not found', [
                    'batch_key' => $batchKey,
                    'user_id' => $dataIsolation->getCurrentUserId(),
                ]);
                return FileBatchOperationStatusResponseDTO::createNotFound();
            }

            // Log the status check
            $this->logger->debug('Batch operation status retrieved', [
                'batch_key' => $batchKey,
                'status' => $taskStatus['status'] ?? 'unknown',
                'operation' => $taskStatus['operation'] ?? 'unknown',
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);

            // Create response DTO from task status
            return FileBatchOperationStatusResponseDTO::fromTaskStatus($taskStatus);
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in checking batch operation status', [
                'batch_key' => $requestDTO->getBatchKey(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in checking batch operation status', [
                'batch_key' => $requestDTO->getBatchKey(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.check_batch_status_failed'));
        }
    }

    /**
     * Replace file with new file.
     *
     * @param RequestContext $requestContext Request context
     * @param int $fileId Target file ID to replace
     * @param ReplaceFileRequestDTO $requestDTO Request DTO
     * @return array Replaced file information
     */
    public function replaceFile(
        RequestContext $requestContext,
        int $fileId,
        ReplaceFileRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. 权限验证和文件存在性检查
            $fileEntity = $this->taskFileDomainService->getById($fileId);
            if (empty($fileEntity)) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_NOT_FOUND,
                    trans('file.file_not_found')
                );
            }

            // 检查是否为目录（边界1：不允许替换目录）
            if ($fileEntity->getIsDirectory()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_OPERATION_NOT_ALLOWED,
                    trans('file.cannot_replace_directory')
                );
            }

            // Check project permission (require EDITOR role for file replacement)
            $projectEntity = $this->getAccessibleProjectWithEditor(
                $fileEntity->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            // 2. 检查文件编辑状态（边界2：文件正在被编辑）
            // TODO: 实现编辑状态检查逻辑
            // $editingUsers = $this->getFileEditingUsers($fileId);
            // if (!empty($editingUsers) && !$requestDTO->getForceReplace()) {
            //     ExceptionBuilder::throw(...);
            // }

            // 3. 验证新文件在云存储中存在（边界3：源文件不存在）
            $newFileKey = $requestDTO->getFileKey();
            $organizationCode = $projectEntity->getUserOrganizationCode();
            $newFileInfo = $this->taskFileDomainService->getFileInfoFromCloudStorage(
                $newFileKey,
                $organizationCode
            );

            if (empty($newFileInfo)) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_NOT_FOUND,
                    trans('file.source_file_not_found_in_storage')
                );
            }

            // 4. 构建新的文件名和目标file_key
            // 场景1：提供了新文件名 -> 使用用户指定的文件名
            // 场景2：未提供文件名 -> 从新文件的 file_key 中提取文件名
            if (! empty($requestDTO->getFileName())) {
                $newFileName = $requestDTO->getFileName();
            } else {
                // 从新文件路径中提取文件名
                $newFileName = basename($newFileKey);
            }

            // 构建目标文件路径：原文件目录 + 新文件名
            $targetFileKey = dirname($fileEntity->getFileKey()) . '/' . $newFileName;

            $newFileExtension = pathinfo($newFileName, PATHINFO_EXTENSION);
            $oldFileExtension = $fileEntity->getFileExtension();

            // 检测跨类型替换（边界4：文件类型变化）
            $isCrossTypeReplace = ($oldFileExtension !== $newFileExtension);

            // 5. 文件名冲突检查（边界5：目标位置已有其他文件）
            if ($targetFileKey !== $fileEntity->getFileKey()) {
                $existingFile = $this->taskFileDomainService->getByFileKey($targetFileKey);
                if (! empty($existingFile)) {
                    ExceptionBuilder::throw(
                        SuperAgentErrorCode::FILE_EXIST,
                        trans('file.target_file_already_exists')
                    );
                }
            }

            // 6. 工作目录安全检查（边界6：防止路径穿越）
            $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

            if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $targetFileKey)) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_ILLEGAL_KEY,
                    trans('file.illegal_file_key')
                );
            }

            if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkdir, $newFileKey)) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_ILLEGAL_KEY,
                    trans('file.source_file_key_illegal')
                );
            }

            Db::beginTransaction();
            try {
                $prefix = WorkDirectoryUtil::getPrefix($projectEntity->getWorkDir());
                $oldFileKey = $fileEntity->getFileKey();

                // 7. 创建版本快照（在替换之前）
                $versionEntity = $this->taskFileVersionDomainService->createFileVersion(
                    $projectEntity->getUserOrganizationCode(),
                    $fileEntity,
                    $isCrossTypeReplace ? 2 : 1  // 跨类型替换使用特殊标记
                );

                if (empty($versionEntity)) {
                    $this->logger->warning('Failed to create version snapshot before replace', [
                        'file_id' => $fileId,
                    ]);
                }

                if ($oldFileKey !== $targetFileKey) {
                    $this->cloudFileRepository->deleteObjectByCredential(
                        $prefix,
                        $organizationCode,
                        $oldFileKey,
                        StorageBucketType::SandBox
                    );

                    $this->logger->info('Old file deleted after version backup', [
                        'file_id' => $fileId,
                        'old_file_key' => $oldFileKey,
                        'version_id' => $versionEntity?->getId(),
                    ]);

                    // 8.2 移动新文件到目标位置（如果需要）
                    $this->cloudFileRepository->renameObjectByCredential(
                        $prefix,
                        $organizationCode,
                        $newFileKey,
                        $targetFileKey,
                        StorageBucketType::SandBox
                    );

                    $this->logger->info('New file moved to target location', [
                        'file_id' => $fileId,
                        'source_key' => $newFileKey,
                        'target_key' => $targetFileKey,
                    ]);
                }

                // 9. 更新数据库记录
                $fileEntity->setFileKey($targetFileKey);
                $fileEntity->setFileName($newFileName);
                $fileEntity->setFileExtension($newFileExtension);
                $fileEntity->setFileSize($newFileInfo['size']);
                $fileEntity->setUpdatedAt(date('Y-m-d H:i:s'));
                $newFileEntity = $this->taskFileDomainService->updateById($fileEntity);

                Db::commit();

                // 10. 发布事件
                $fileReplacedEvent = new FileReplacedEvent(
                    $newFileEntity,
                    $versionEntity,
                    $userAuthorization,
                    $isCrossTypeReplace
                );
                $this->eventDispatcher->dispatch($fileReplacedEvent);

                // 11. 返回结果
                return TaskFileItemDTO::fromEntity($newFileEntity, $projectEntity->getWorkDir())->toArray();
            } catch (Throwable $e) {
                Db::rollBack();

                $this->logger->error('Failed to replace file, transaction rolled back', [
                    'file_id' => $fileId,
                    'source_key' => $newFileKey,
                    'target_key' => $targetFileKey,
                    'error' => $e->getMessage(),
                ]);

                throw $e;
            }
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business logic error in replace file: %s, File ID: %s, Error Code: %d',
                $e->getMessage(),
                $fileId,
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in replace file: %s, File ID: %s',
                $e->getMessage(),
                $fileId
            ));
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_REPLACE_FAILED,
                trans('file.file_replace_failed')
            );
        }
    }

    /**
     * Get file tree.
     *
     * Query priority: topic_id first, then sandbox_id
     * - If topic_id is provided, query by topic_id first
     * - If not found or not provided, query by sandbox_id
     * - Throw exception if both queries fail
     *
     * @param RequestContext $requestContext Request context
     * @param GetFileTreeRequestDTO $requestDTO Request DTO (requires topic_id or sandbox_id)
     * @return GetFileTreeResponseDTO File tree
     */
    public function getFileTree(RequestContext $requestContext, GetFileTreeRequestDTO $requestDTO): GetFileTreeResponseDTO
    {
        $topicId = $requestDTO->getTopicId();
        $sandboxId = $requestDTO->getSandboxId();
        $depth = $requestDTO->getDepth();

        $this->logger->info('Getting file tree', [
            'topic_id' => $topicId,
            'sandbox_id' => $sandboxId,
            'depth' => $depth,
        ]);

        try {
            // 1. Query Topic with priority: topic_id first, then sandbox_id
            $topicEntity = null;

            // Priority 1: Try to query by topic_id
            if (! empty($topicId) && is_numeric($topicId)) {
                $topicEntity = $this->topicDomainService->getTopicById((int) $topicId);
                if ($topicEntity) {
                    $this->logger->debug('Topic found by topic_id', [
                        'topic_id' => $topicId,
                        'project_id' => $topicEntity->getProjectId(),
                    ]);
                } else {
                    $this->logger->warning('Topic not found by topic_id, will try sandbox_id', [
                        'topic_id' => $topicId,
                    ]);
                }
            }

            // Priority 2: If not found by topic_id, try sandbox_id
            if (! $topicEntity && ! empty($sandboxId)) {
                $topicEntity = $this->topicDomainService->getTopicBySandboxId($sandboxId);
                if ($topicEntity) {
                    $this->logger->debug('Topic found by sandbox_id', [
                        'sandbox_id' => $sandboxId,
                        'topic_id' => $topicEntity->getId(),
                        'project_id' => $topicEntity->getProjectId(),
                    ]);
                }
            }

            // If still not found, throw exception
            if (! $topicEntity) {
                $this->logger->warning('Topic not found', [
                    'topic_id' => $topicId,
                    'sandbox_id' => $sandboxId,
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, trans('topic.not_found'));
            }

            $projectId = $topicEntity->getProjectId();
            if ($projectId <= 0) {
                $this->logger->warning('Project ID not found in topic', [
                    'topic_id' => $topicEntity->getId(),
                    'sandbox_id' => $topicEntity->getSandboxId(),
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.not_found'));
            }

            $this->logger->debug('Found project for topic', [
                'topic_id' => $topicEntity->getId(),
                'sandbox_id' => $topicEntity->getSandboxId(),
                'project_id' => $projectId,
            ]);

            // 2. Validate project permission
            $userAuthorization = $requestContext->getUserAuthorization();
            $projectEntity = $this->getAccessibleProject(
                $projectId,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );

            $this->logger->debug('Project permission validated', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'user_id' => $userAuthorization->getId(),
            ]);

            // 3. Get project root file
            $rootFileEntity = $this->taskFileDomainService->getRootFile($projectId);
            if (! $rootFileEntity) {
                $this->logger->warning('Root file not found for project', [
                    'topic_id' => $topicEntity->getId(),
                    'project_id' => $projectId,
                ]);
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.root_not_found'));
            }

            $this->logger->debug('Found root file', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'root_file_id' => $rootFileEntity->getFileId(),
                'root_file_name' => $rootFileEntity->getFileName(),
            ]);

            // 4. Query all child files under root node using BFS algorithm
            // depth parameter: null or -1 means unlimited, use default 10 levels; otherwise use specified depth
            $maxDepth = ($depth === null || $depth < 0) ? 10 : $depth;

            $childFileEntities = $this->taskFileDomainService->findFilesRecursivelyByParentId(
                $projectId,
                $rootFileEntity->getFileId(),  // Use root node file ID as parent ID
                $maxDepth
            );

            // 5. Merge root node into file list (root node at the front)
            $allFileEntities = array_merge([$rootFileEntity], $childFileEntities);

            $this->logger->info('Retrieved project files using BFS', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'root_file_id' => $rootFileEntity->getFileId(),
                'total_file_count' => count($allFileEntities),
                'max_depth' => $maxDepth,
            ]);

            // 6. Convert TaskFileEntity list to array format
            $allFiles = [];
            foreach ($allFileEntities as $fileEntity) {
                $allFiles[] = [
                    'file_id' => $fileEntity->getFileId(),
                    'parent_id' => $fileEntity->getParentId() ?? 0,
                    'name' => $fileEntity->getFileName(),
                    'file_name' => $fileEntity->getFileName(), // Required by FileTreeUtil
                    'is_directory' => $fileEntity->getIsDirectory(),
                    'file_size' => $fileEntity->getFileSize(),
                    'created_at' => $fileEntity->getCreatedAt(),
                    'updated_at' => $fileEntity->getUpdatedAt(),
                    'sort' => $fileEntity->getSort(), // Used for sorting
                ];
            }

            // 7. Convert file list to tree structure
            $fileTree = FileTreeUtil::assembleFilesTreeByParentId($allFiles);

            $this->logger->info('File tree built successfully', [
                'topic_id' => $topicEntity->getId(),
                'project_id' => $projectId,
                'root_nodes' => count($fileTree),
            ]);

            // 8. Return root node (first node is the root node, contains complete subtree)
            $rootNode = $fileTree[0] ?? [
                'file_id' => $rootFileEntity->getFileId(),
                'name' => $rootFileEntity->getFileName(),
                'parent_id' => $rootFileEntity->getParentId() ?? 0,
                'is_directory' => true,
                'file_size' => $rootFileEntity->getFileSize(),
                'created_at' => $rootFileEntity->getCreatedAt(),
                'updated_at' => $rootFileEntity->getUpdatedAt(),
                'children' => [],
            ];

            // 9. Convert to response DTO
            return GetFileTreeResponseDTO::fromTreeData($rootNode);
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in get file tree', [
                'topic_id' => $topicId,
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in get file tree', [
                'topic_id' => $topicId,
                'sandbox_id' => $sandboxId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.get_tree_failed'));
        }
    }

    /**
     * Get project ID from share entity.
     *
     * @param ResourceShareEntity $shareEntity Share entity
     * @return int Project ID
     */
    private function getProjectIdFromShare(ResourceShareEntity $shareEntity): int
    {
        switch ($shareEntity->getResourceType()) {
            case ResourceType::Topic->value:
                $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
                if (empty($topicEntity)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
                }
                return $topicEntity->getProjectId();
            case ResourceType::Project->value:
                return (int) $shareEntity->getProjectId();
            case ResourceType::FileCollection->value:
                $collectionId = (int) $shareEntity->getResourceId();
                $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
                if (empty($projectId)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
                }
                return $projectId;
            default:
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported');
        }
    }

    /**
     * Expand directory file IDs to include all nested files.
     *
     * This method processes a list of file IDs and expands any directories
     * to include all their nested files. This ensures that when moving or
     * operating on directories, all contained files are included.
     *
     * @param DataIsolation $dataIsolation Data isolation context
     * @param array $fileIds Original file IDs (may contain directories)
     * @param int $projectId Project ID
     * @return array Expanded file IDs (includes all nested files from directories)
     */
    private function expandDirectoryFileIds(DataIsolation $dataIsolation, array $fileIds, int $projectId): array
    {
        $allFileIds = [];

        // Get all file entities
        $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($projectId, $fileIds);

        foreach ($fileEntities as $fileEntity) {
            // Always include the file/directory itself
            $allFileIds[] = $fileEntity->getFileId();

            // If it's a directory, expand to get all nested files
            if ($fileEntity->getIsDirectory()) {
                $nestedFileIds = $this->taskFileDomainService->getDirectoryFileIds(
                    $dataIsolation,
                    $fileEntity
                );

                // Merge nested file IDs
                if (! empty($nestedFileIds)) {
                    $allFileIds = array_merge($allFileIds, $nestedFileIds);
                }
            }
        }

        // Remove duplicates and reindex
        return array_values(array_unique($allFileIds));
    }
}
