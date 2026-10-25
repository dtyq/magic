<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\File\Service\FileAppService;
use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\File\Event\Publish\FileBatchCopyPublisher;
use App\Application\SuperMagic\File\Event\Publish\FileBatchMovePublisher;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\Domain\SuperMagic\Common\Entity\ValueObject\StorageType;
use App\Domain\SuperMagic\Common\Share\Constant\ResourceType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Constant\ProjectFileConstant;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileSpaceType;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileType;
use App\Domain\SuperMagic\File\Entity\ValueObject\TaskFileSource;
use App\Domain\SuperMagic\File\Event\AttachmentsProcessedEvent;
use App\Domain\SuperMagic\File\Event\DirectoryDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileBatchCopyEvent;
use App\Domain\SuperMagic\File\Event\FileBatchMoveEvent;
use App\Domain\SuperMagic\File\Event\FileDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileMovedEvent;
use App\Domain\SuperMagic\File\Event\FileRenamedEvent;
use App\Domain\SuperMagic\File\Event\FileReplacedEvent;
use App\Domain\SuperMagic\File\Event\FilesBatchDeletedEvent;
use App\Domain\SuperMagic\File\Event\FileUploadedEvent;
use App\Domain\SuperMagic\File\Service\FileCollectionDomainService;
use App\Domain\SuperMagic\File\Service\MagicFSFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileVersionDomainService;
use App\Domain\SuperMagic\File\Service\UpsertProjectFileNodeDTO;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\MagicFSErrorCode;
use App\ErrorCode\ShareErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\SuperMagic\Utils\AccessTokenUtil;
use App\Infrastructure\SuperMagic\Utils\FileBatchOperationStatusManager;
use App\Infrastructure\SuperMagic\Utils\FileTreeUtil;
use App\Infrastructure\SuperMagic\Utils\RelativeFilePathUtil;
use App\Infrastructure\SuperMagic\Utils\WorkDirectoryUtil;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\DTO\Request\CheckBatchOperationStatusRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchCopyFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchDeleteFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchMoveFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\BatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\CreateFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\DeleteDirectoryRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetFileTreeRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\ReplaceFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\SaveProjectFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\ScanWavFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UpdateFileSourceRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileBatchOperationResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\FileBatchOperationStatusResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\GetFileTreeResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\TaskFileItemDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Request\TopicUploadTokenRequestDTO;
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
        private readonly TaskFileAuthorizationService $taskFileAuthorizationService,
        private readonly TaskFileVersionDomainService $taskFileVersionDomainService,
        private readonly ResourceShareDomainService $resourceShareDomainService,
        private readonly FileBatchOperationStatusManager $batchOperationStatusManager,
        private readonly LockerInterface $locker,
        private readonly Producer $producer,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly ProjectDomainService $projectDomainService,
        private readonly FileCollectionDomainService $fileCollectionDomainService,
        private readonly MagicFSFileDomainService $magicFSFileDomainService,
        private readonly FileDomainService $fileDomainService,
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
            // Uploading files is a write operation. Resolve the project through the
            // access check so a topic ID from another user's project cannot be used
            // to mint an upload credential.
            $projectEntity = $this->getAccessibleProjectWithEditor(
                $topicEntity->getProjectId(),
                $userId,
                $organizationCode
            );
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
        $projectId = (int) $requestDTO->getProjectId();
        $fileKey = $requestDTO->getFileKey();

        // 项目空间按项目权限校验，用户空间按文件 owner 校验。
        $projectEntity = null;
        if ($projectId > 0) {
            $projectEntity = $this->getAccessibleProjectWithEditor(
                $projectId,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );
            $workDir = $projectEntity->getWorkDir();
            $storageOrganizationCode = $projectEntity->getUserOrganizationCode();
        } else {
            $this->getUserSpaceDirectory((int) $requestDTO->getParentId(), $userAuthorization);
            $workDir = WorkDirectoryUtil::getUserWorkDir($userAuthorization->getId());
            $storageOrganizationCode = $userAuthorization->getOrganizationCode();
            $this->assertUserSpaceFileKey($storageOrganizationCode, $workDir, $fileKey);
        }

        $lockName = $this->getFileSpaceLockName($projectId, $userAuthorization->getId());
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
            if (! empty($requestDTO->getParentId())) {
                $parentFileEntity = $this->taskFileDomainService->getById((int) $requestDTO->getParentId());
                if (empty($parentFileEntity) || $parentFileEntity->getProjectId() !== $projectId) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.not_found'));
                }
                $this->getAccessibleProjectForTaskFile($parentFileEntity, $userAuthorization, MemberRole::EDITOR);
            }

            // 创建 TaskFileEntity 实体
            $taskFileEntity = $requestDTO->toEntity();
            if ($projectId <= 0) {
                $taskFileEntity->setSpaceType('user');
            }

            // saveFile 已不再使用 sort 字段，跳过排序值计算，实体保持默认 sort。
            // 若后续恢复使用：根层级（无 parentId）的项目空间文件需按 space_type=project 过滤，
            // 避免 topic 空间的 .topic 根节点混入项目根层级的排序计算
            // $sortSpaceType = empty($requestDTO->getParentId()) && $taskFileEntity->getSpaceType() === FileSpaceType::PROJECT->value
            //     ? FileSpaceType::PROJECT->value
            //     : null;
            // $sortValue = $this->taskFileDomainService->calculateSortForNewFile(
            //     ! empty($requestDTO->getParentId()) ? (int) $requestDTO->getParentId() : null,
            //     (int) $requestDTO->getPreFileId(),
            //     $projectId,
            //     $sortSpaceType
            // );
            // $taskFileEntity->setSort($sortValue);

            // 调用领域服务保存文件
            $savedEntity = $this->taskFileDomainService->upsertProjectFileNode(
                new UpsertProjectFileNodeDTO(
                    projectId: $projectId,
                    projectWorkDir: $workDir,
                    projectOrganizationCode: $storageOrganizationCode,
                    operatorUserId: $dataIsolation->getCurrentUserId(),
                    operatorOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    taskFileEntity: $taskFileEntity,
                    storageTypeOverride: FileSpaceType::resolveStorageType($taskFileEntity->getSpaceType())->value,
                    isHidden: $requestDTO->getIsHidden()
                )
            );

            Db::commit();

            // 项目文件发布上传事件，用户空间文件不进入项目事件流。
            if ($savedEntity->isProjectFile()) {
                $this->dispatchFileUploadedEvent($savedEntity, $userAuthorization);
            }

            // 返回保存结果
            $relativeFilePath = $this->buildRelativeFilePathForEntity($savedEntity, $projectId);
            return TaskFileItemDTO::fromEntity($savedEntity, $workDir, $relativeFilePath)->toArray();
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

        if ($projectId <= 0) {
            return $this->batchSaveUserSpaceFiles($userAuthorization, $requestDTO);
        }

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
        $defaultParentId = $requestDTO->getParentId();

        Db::beginTransaction();
        try {
            // 2. 顶层 parent_id 前置校验（如传入）
            $this->validateBatchSaveParentDirectory($defaultParentId, $projectEntity->getId());

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
                    $fileData['parent_id'] = $this->resolveBatchSaveFileParentId($fileData, $defaultParentId);
                    $saveFileRequestDTO = SaveProjectFileRequestDTO::fromRequest($fileData);

                    // 创建文件实体
                    $taskFileEntity = $saveFileRequestDTO->toEntity();

                    // 保存文件（不设置排序值）
                    $savedEntity = $this->taskFileDomainService->upsertProjectFileNode(
                        new UpsertProjectFileNodeDTO(
                            projectId: $projectEntity->getId(),
                            projectWorkDir: $projectEntity->getWorkDir(),
                            projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                            operatorUserId: $dataIsolation->getCurrentUserId(),
                            operatorOrganizationCode: $dataIsolation->getCurrentOrganizationCode(),
                            taskFileEntity: $taskFileEntity,
                            storageTypeOverride: StorageType::WORKSPACE->value,
                            isHidden: $saveFileRequestDTO->getIsHidden()
                        )
                    );

                    $relativeFilePath = $this->buildRelativeFilePathForEntity($savedEntity, $projectEntity->getId());
                    $savedFileIds[] = TaskFileItemDTO::fromEntity($savedEntity, $projectEntity->getWorkDir(), $relativeFilePath);
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

            $this->dispatchFileUploadedEvents($savedEntities, $userAuthorization);

            // 4. Check if any saved files are metadata files and trigger event once
            foreach ($savedEntities as $savedEntity) {
                if (ProjectFileConstant::isSetMetadataFile($savedEntity->getFileName())) {
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
        $ignoreDuplicate = $requestDTO->getIgnoreDuplicate();

        Db::beginTransaction();
        try {
            $projectId = (int) $requestDTO->getProjectId();
            $parentId = ! empty($requestDTO->getParentId()) ? (int) $requestDTO->getParentId() : 0;
            $projectEntity = null;

            if ($projectId > 0) {
                // 项目空间保持原有项目角色鉴权和根目录补全逻辑。
                $projectEntity = $this->getAccessibleProjectWithEditor(
                    $projectId,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                );
                if (empty($parentId)) {
                    $parentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                        projectId: $projectId,
                        workDir: $projectEntity->getWorkDir(),
                        userId: $dataIsolation->getCurrentUserId(),
                        organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                        projectOrganizationCode: $projectEntity->getUserOrganizationCode(),
                    );
                } else {
                    $parentEntity = $this->taskFileDomainService->getDirectoryByIdAndProject($parentId, $projectId);
                    if ($parentEntity === null) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
                    }
                }
            } else {
                // 用户空间没有项目根节点，必须由父目录锚定并使用文件 owner 鉴权。
                $parentEntity = $this->getUserSpaceDirectory($parentId, $userAuthorization);
                $projectId = $parentEntity->getProjectId();
            }

            $workDir = $projectEntity?->getWorkDir()
                ?? WorkDirectoryUtil::getUserWorkDir($userAuthorization->getId());

            if ($ignoreDuplicate) {
                $existingFileEntity = $this->taskFileDomainService->getByProjectParentAndName(
                    projectId: $projectId,
                    parentId: $parentId,
                    fileName: $requestDTO->getFileName(),
                    withTrash: false
                );
                if ($existingFileEntity !== null) {
                    Db::commit();
                    $relativeFilePath = $this->buildRelativeFilePathForEntity($existingFileEntity, $projectId);
                    return TaskFileItemDTO::fromEntity($existingFileEntity, $workDir, $relativeFilePath)->toArray();
                }
            }

            // 根据是否为目录确定文件类型；用户新建的文件标记为 user_create，与用户上传（user_upload）区分
            $fileType = $requestDTO->getIsDirectory() ? FileType::DIRECTORY : FileType::USER_CREATE;

            try {
                // 调用 MagicFS 领域服务创建文件（会自动发布事件）
                $taskFileEntity = $this->magicFSFileDomainService->createFile(
                    $requestDTO->getFileName(),
                    (string) $parentId,
                    $requestDTO->getIsDirectory(),
                    null,
                    null,
                    $fileType,
                    TaskFileSource::PROJECT_DIRECTORY,
                    null,
                    false,
                    0
                );
            } catch (BusinessException $e) {
                if ($ignoreDuplicate && $e->getCode() === MagicFSErrorCode::FILE_ALREADY_EXISTS->value) {
                    $existingFileEntity = $this->taskFileDomainService->getByProjectParentAndName(
                        projectId: $projectId,
                        parentId: $parentId,
                        fileName: $requestDTO->getFileName(),
                        withTrash: false
                    );
                    if ($existingFileEntity !== null) {
                        Db::commit();
                        $relativeFilePath = $this->buildRelativeFilePathForEntity($existingFileEntity, $projectId);
                        return TaskFileItemDTO::fromEntity($existingFileEntity, $workDir, $relativeFilePath)->toArray();
                    }
                }
                throw $e;
            }

            Db::commit();

            if ($taskFileEntity->isProjectFile()) {
                // 项目专属事件不应处理用户空间文件。
                $this->eventDispatcher->dispatch(new FileUploadedEvent(
                    $taskFileEntity,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode(),
                ));
            }

            // 构建基于 parent_id 链的相对文件路径
            $relativeFilePath = $this->buildRelativeFilePathForEntity($taskFileEntity, $projectId);

            // 返回创建结果
            return TaskFileItemDTO::fromEntity($taskFileEntity, $workDir, $relativeFilePath)->toArray();
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

        try {
            // 1. Fetch the file entity through MagicFS (covers both files and directories).
            $fileEntity = $this->magicFSFileDomainService->getFileById((string) $fileId);

            // 2. 校验编辑权限，用户空间文件使用 task_files owner 权限。
            $this->getAccessibleProjectForTaskFile(
                $fileEntity,
                $userAuthorization,
                MemberRole::EDITOR,
            );

            // 3. Soft-delete the entry itself only.
            //    For directories, descendants are intentionally left intact: this endpoint
            //    is a single-node deletion and does not propagate to children.
            $this->magicFSFileDomainService->deleteFile((string) $fileId);

            if ($fileEntity->isProjectFile()) {
                // 项目空间文件才进入回收站/物理删除策略链路。
                if ($fileEntity->getIsDirectory()) {
                    $this->eventDispatcher->dispatch(new DirectoryDeletedEvent($fileEntity, $userAuthorization));
                } else {
                    $this->eventDispatcher->dispatch(new FileDeletedEvent(
                        $fileEntity,
                        $userAuthorization->getId(),
                        $userAuthorization->getOrganizationCode()
                    ));
                }
            }

            return ['file_id' => $fileId];
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

        try {
            $fileId = (int) $requestDTO->getFileId();

            // 1. 使用 MagicFS 获取文件实体（目录也是文件）
            $fileEntity = $this->magicFSFileDomainService->getFileById((string) $fileId);

            // 2. 校验编辑权限，用户空间文件使用 task_files owner 权限。
            $this->getAccessibleProjectForTaskFile(
                $fileEntity,
                $userAuthorization,
                MemberRole::EDITOR,
            );

            // 3. 调用 MagicFS 删除目录
            $this->magicFSFileDomainService->deleteFile((string) $fileId);

            if ($fileEntity->isProjectFile()) {
                $dirUserAuth = new MagicUserAuthorization();
                $dirUserAuth->setId($userAuthorization->getId());
                $dirUserAuth->setOrganizationCode($userAuthorization->getOrganizationCode());
                $this->eventDispatcher->dispatch(new DirectoryDeletedEvent($fileEntity, $dirUserAuth));
            }

            return [
                'file_id' => $fileId,
                'project_id' => $fileEntity->getProjectId(),
            ];
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in delete directory: %s, File ID: %s, Error Code: %d',
                $e->getMessage(),
                $requestDTO->getFileId(),
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in delete directory: %s, File ID: %s',
                $e->getMessage(),
                $requestDTO->getFileId()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, trans('file.directory_delete_failed'));
        }
    }

    public function batchDeleteFiles(RequestContext $requestContext, BatchDeleteFilesRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        try {
            $projectId = (int) $requestDTO->getProjectId();
            $fileIds = array_values(array_unique(array_map('intval', $requestDTO->getFileIds())));

            if ($projectId > 0) {
                $this->getAccessibleProjectWithEditor(
                    $projectId,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode(),
                );
                $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($projectId, $fileIds);
            } else {
                // 用户空间没有项目权限，批量加载后逐文件校验 owner，避免逐文件查询。
                $fileEntities = $this->taskFileDomainService->getFilesByIds($fileIds);
                $fileEntityMap = [];
                foreach ($fileEntities as $fileEntity) {
                    $fileEntityMap[(string) $fileEntity->getFileId()] = $fileEntity;
                }
                foreach ($fileIds as $fileId) {
                    $fileEntity = $fileEntityMap[(string) $fileId] ?? null;
                    if ($fileEntity === null || $fileEntity->getProjectId() !== $projectId) {
                        ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
                    }
                    $this->getAccessibleProjectForTaskFile(
                        $fileEntity,
                        $userAuthorization,
                        MemberRole::EDITOR,
                    );
                }
            }

            // MagicFS 在指定作用域内校验并删除文件，返回删除前实体供事件使用。
            $fileEntities = $this->magicFSFileDomainService->deleteFiles(
                $fileIds,
                false,
                $projectId,
            );

            $this->logger->info(sprintf(
                'Successfully batch deleted files: Project ID: %s, File count: %d',
                $projectId,
                count($fileIds)
            ));

            // Dispatch batch-deleted event so WebSocket / knowledge-base subscribers can react.
            $this->dispatchFilesBatchDeletedEvent($projectId, $fileEntities, $userAuthorization);

            return [
                'project_id' => $projectId,
                'file_ids' => $fileIds,
                'count' => count($fileIds),
            ];
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

        try {
            // 1. 使用 MagicFS 获取文件实体
            $fileEntity = $this->magicFSFileDomainService->getFileById((string) $fileId);

            // 2. 校验编辑权限，用户空间文件使用 task_files owner 权限。
            $projectEntity = $this->getAccessibleProjectForTaskFile(
                $fileEntity,
                $userAuthorization,
                MemberRole::EDITOR,
            );

            // 3. 调用 TaskFileDomainService 重命名（浏览器语义：同名冲突则拒绝）
            $newFileEntity = $this->taskFileDomainService->renameFileWithCheck(
                (string) $fileId,
                $targetName
            );

            if ($newFileEntity->isProjectFile()) {
                // Dispatch file renamed event
                $renamedUserAuth = new MagicUserAuthorization();
                $renamedUserAuth->setId($userAuthorization->getId());
                $renamedUserAuth->setOrganizationCode($userAuthorization->getOrganizationCode());
                $this->eventDispatcher->dispatch(new FileRenamedEvent($newFileEntity, $renamedUserAuth));
            }

            // 4. 返回重命名后的文件信息
            return TaskFileItemDTO::fromEntity($newFileEntity, $projectEntity?->getWorkDir() ?? '')->toArray();
        } catch (BusinessException $e) {
            // 捕获业务异常（ExceptionBuilder::throw 抛出的异常）
            $this->logger->warning(sprintf(
                'Business logic error in rename file: %s, File ID: %s, Target Name: %s, Error Code: %d',
                $e->getMessage(),
                $fileId,
                $targetName,
                $e->getCode()
            ));
            // 直接重新抛出业务异常，让上层处理
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in rename file: %s, File ID: %s, Target Name: %s',
                $e->getMessage(),
                $fileId,
                $targetName
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
     * @param null|int $targetProjectId Target project ID (null means same project)
     * @param array $keepBothFileIds Array of source file IDs that should not overwrite when conflict occurs
     * @param bool $preserveParentPath Whether to preserve source parent directories for cross-project moves
     * @return array Move result
     */
    public function moveFile(
        RequestContext $requestContext,
        int $fileId,
        int $targetParentId,
        ?int $targetProjectId = null,
        array $keepBothFileIds = [],
        bool $preserveParentPath = false
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $sourceProjectLogId = null;
        $targetProjectLogId = null;

        try {
            // 1. 先按文件 ID 获取实体，再根据文件空间选择权限校验方式。
            $fileEntity = $this->taskFileDomainService->getById($fileId);
            if ($fileEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }

            if (! $fileEntity->isProjectFile()) {
                return $this->moveUserSpaceFile(
                    $userAuthorization,
                    $fileEntity,
                    $targetParentId,
                    $targetProjectId,
                    $keepBothFileIds,
                );
            }

            // 2. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                $fileEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
            $sourceProjectLogId = $sourceProject->getId();

            // 3. Get target project (if not provided, use source project)
            $targetProject = $targetProjectId
                ? $this->getAccessibleProjectWithEditor(
                    $targetProjectId,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode()
                )
                : $sourceProject;
            $targetProjectLogId = $targetProject->getId();

            // 4. Handle target parent directory
            if (empty($targetParentId)) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $targetProject->getId(),
                    workDir: $targetProject->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    projectOrganizationCode: $targetProject->getUserOrganizationCode()
                );
            } else {
                $targetParentEntity = $this->taskFileDomainService->getById($targetParentId);
                if ($targetParentEntity === null || ! $targetParentEntity->getIsDirectory()) {
                    ExceptionBuilder::throw(
                        GenericErrorCode::ParameterValidationFailed,
                        trans('file.target_parent_not_directory')
                    );
                }

                if ($targetParentEntity->getProjectId() !== $targetProject->getId()) {
                    ExceptionBuilder::throw(
                        SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                        trans('file.target_parent_not_in_target_project')
                    );
                }
            }

            $isCrossProject = $sourceProject->getId() !== $targetProject->getId();
            $isCrossOrganization = $sourceProject->getUserOrganizationCode() !== $targetProject->getUserOrganizationCode();
            $preserveParentPath = $isCrossProject && $preserveParentPath;
            $hasKeepBoth = ! empty($keepBothFileIds);
            $shouldAsync = $isCrossProject || $isCrossOrganization || $hasKeepBoth;

            // 5. Async move for cross-project/cross-organization/keep-both scenarios
            if ($shouldAsync) {
                $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                    FileBatchOperationStatusManager::OPERATION_MOVE,
                    $dataIsolation->getCurrentUserId(),
                    (string) $fileEntity->getFileId()
                );

                $fileIds = $fileEntity->getIsDirectory()
                    ? $this->collectSubtreeFileIdsByMagicFs($fileEntity->getFileId())
                    : [$fileEntity->getFileId()];

                // Initialize task status
                $this->batchOperationStatusManager->initializeTask(
                    $batchKey,
                    FileBatchOperationStatusManager::OPERATION_MOVE,
                    $dataIsolation->getCurrentUserId(),
                    count($fileIds)
                );

                $event = FileBatchMoveEvent::fromDTO(
                    $batchKey,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $fileIds,
                    $targetProject->getId(),
                    $sourceProject->getId(),
                    null,
                    $targetParentId,
                    $keepBothFileIds,
                    $preserveParentPath
                );

                $this->logger->info(sprintf('Move directory request data, batchKey: %s', $batchKey), [
                    'file_ids' => $fileIds,
                    'source_project_id' => $sourceProjectLogId,
                    'target_project_id' => $targetProjectLogId,
                    'target_parent_id' => $targetParentId,
                    'keep_both_file_ids' => $keepBothFileIds,
                    'preserve_parent_path' => $preserveParentPath,
                ]);

                $publisher = new FileBatchMovePublisher($event);
                $this->producer->produce($publisher);

                // Return asynchronous response
                return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
            }

            // 6. Sync move: same project and same organization without keep-both
            $oldParentId = $fileEntity->getParentId();
            // Pre-detect overwritten file before moveFileWithCheck silently handles it via MagicFS
            $overwrittenFile = null;
            if (! $fileEntity->getIsDirectory()) {
                $targetParentIdForCheck = $targetParentId <= 0 ? null : $targetParentId;
                $candidate = $this->taskFileDomainService->getByProjectParentAndName(
                    $fileEntity->getProjectId(),
                    $targetParentIdForCheck,
                    $fileEntity->getFileName()
                );
                if ($candidate !== null && $candidate->getFileId() !== $fileEntity->getFileId() && ! $candidate->getIsDirectory()) {
                    $overwrittenFile = $candidate;
                }
            }
            $updatedFileEntity = $this->taskFileDomainService->moveFileWithCheck(
                (string) $fileEntity->getFileId(),
                (string) $targetParentId,
                true
            );

            // Dispatch file moved event with oldParentId so subscribers can clean up stale display_config
            $movedUserAuth = new MagicUserAuthorization();
            $movedUserAuth->setId($userAuthorization->getId());
            $movedUserAuth->setOrganizationCode($userAuthorization->getOrganizationCode());
            $this->eventDispatcher->dispatch(new FileMovedEvent($updatedFileEntity, $movedUserAuth, $oldParentId, $overwrittenFile));

            // 7. Re-get file entity with updated data
            $newFileEntity = $this->taskFileDomainService->getById($fileId);

            // Build relative file path based on parent_id chain
            $relativeFilePath = $this->buildRelativeFilePathForEntity($newFileEntity, $targetProject->getId());

            $result = TaskFileItemDTO::fromEntity($newFileEntity, $targetProject->getWorkDir(), $relativeFilePath)->toArray();
            return FileBatchOperationResponseDTO::createSyncSuccess($result)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in move file', [
                'file_id' => $fileId,
                'source_project_id' => $sourceProjectLogId,
                'target_project_id' => $targetProjectLogId,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in move file', [
                'file_id' => $fileId,
                'source_project_id' => $sourceProjectLogId,
                'target_project_id' => $targetProjectLogId,
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
     * @param bool $preserveParentPath Whether to preserve source parent directories for cross-project copies
     * @return array Copy result
     */
    public function copyFile(
        RequestContext $requestContext,
        int $fileId,
        int $targetParentId,
        ?int $preFileId = null,
        ?int $targetProjectId = null,
        array $keepBothFileIds = [],
        bool $preserveParentPath = false
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $sourceProjectLogId = null;
        $targetProjectLogId = null;

        try {
            // 1. Get source file entity
            $fileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($fileId);

            // 2. Get source project and verify permission
            $sourceProject = $this->getAccessibleProjectWithEditor(
                $fileEntity->getProjectId(),
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            );
            $sourceProjectLogId = $sourceProject->getId();

            // 3. Get target project (if not provided, use source project)
            $targetProject = $targetProjectId
                ? $this->getAccessibleProjectWithEditor(
                    $targetProjectId,
                    $userAuthorization->getId(),
                    $userAuthorization->getOrganizationCode()
                )
                : $sourceProject;
            $targetProjectLogId = $targetProject->getId();

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

            $targetParentEntity = $this->taskFileDomainService->getById($targetParentId);
            if ($targetParentEntity === null || ! $targetParentEntity->getIsDirectory()) {
                ExceptionBuilder::throw(
                    GenericErrorCode::ParameterValidationFailed,
                    trans('file.target_parent_not_directory')
                );
            }
            if ($targetParentEntity->getProjectId() !== $targetProject->getId()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                    trans('file.target_parent_not_in_target_project')
                );
            }

            $isCrossProject = $sourceProject->getId() !== $targetProject->getId();
            $isCrossOrganization = $sourceProject->getUserOrganizationCode() !== $targetProject->getUserOrganizationCode();
            $preserveParentPath = $isCrossProject && $preserveParentPath;
            $shouldAsync = $fileEntity->getIsDirectory() || $isCrossProject || $isCrossOrganization;

            // 5. Directory/cross-project/cross-organization copy: use asynchronous processing
            if ($shouldAsync) {
                $batchKey = $this->batchOperationStatusManager->generateBatchKey(
                    FileBatchOperationStatusManager::OPERATION_COPY,
                    $dataIsolation->getCurrentUserId(),
                    (string) $fileEntity->getFileId()
                );

                $fileIds = $fileEntity->getIsDirectory()
                    ? $this->collectSubtreeFileIdsByMagicFs($fileEntity->getFileId())
                    : [$fileEntity->getFileId()];

                // Initialize task status
                $this->batchOperationStatusManager->initializeTask(
                    $batchKey,
                    FileBatchOperationStatusManager::OPERATION_COPY,
                    $dataIsolation->getCurrentUserId(),
                    count($fileIds)
                );

                // Publish copy event
                $event = FileBatchCopyEvent::fromDTO(
                    $batchKey,
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode(),
                    $fileIds,
                    $targetProject->getId(),
                    $sourceProject->getId(),
                    $preFileId,
                    $targetParentId,
                    $keepBothFileIds,
                    $preserveParentPath
                );

                $this->logger->info(sprintf('Copy directory request data, batchKey: %s', $batchKey), [
                    'file_ids' => $fileIds,
                    'source_project_id' => $sourceProjectLogId,
                    'target_project_id' => $targetProjectLogId,
                    'target_parent_id' => $targetParentId,
                    'pre_file_id' => $preFileId,
                    'keep_both_file_ids' => $keepBothFileIds,
                    'is_directory' => $fileEntity->getIsDirectory(),
                    'is_cross_project' => $isCrossProject,
                    'is_cross_organization' => $isCrossOrganization,
                    'preserve_parent_path' => $preserveParentPath,
                ]);

                $publisher = new FileBatchCopyPublisher($event);
                $this->producer->produce($publisher);

                // Return asynchronous response
                return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
            }

            // 6. Single file sync copy in same project/organization.
            $shouldKeepBoth = in_array((string) $fileEntity->getFileId(), $keepBothFileIds, true);
            $newFileEntity = $this->taskFileDomainService->copyFileToParent(
                (string) $fileEntity->getFileId(),
                (string) $targetParentId,
                null,
                ! $shouldKeepBoth
            );

            if ($newFileEntity->getFileId() === $fileEntity->getFileId()) {
                $result = TaskFileItemDTO::fromEntity($newFileEntity)->toArray();
                return FileBatchOperationResponseDTO::createSyncSuccess($result)->toArray();
            }

            // Dispatch file uploaded event for the new copy
            $this->eventDispatcher->dispatch(new FileUploadedEvent(
                $newFileEntity,
                $userAuthorization->getId(),
                $userAuthorization->getOrganizationCode()
            ));

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
                'source_project_id' => $sourceProjectLogId,
                'target_project_id' => $targetProjectLogId,
                'target_parent_id' => $targetParentId,
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in copy file', [
                'file_id' => $fileId,
                'source_project_id' => $sourceProjectLogId,
                'target_project_id' => $targetProjectLogId,
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
     * @param array $fileIds Array of file IDs
     * @param string $downloadMode Download mode (download, preview)
     * @param array $options Additional options
     * @return array File URLs
     */
    public function getFileUrls(RequestContext $requestContext, array $fileIds, string $downloadMode, array $options = [], array $fileVersions = []): array
    {
        try {
            $userAuthorization = $requestContext->getUserAuthorization();

            return $this->getFileUrlsGroupedByProject($userAuthorization, $fileIds, $downloadMode, $options, $fileVersions);
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

            if ($shareEntity->getResourceType() === ResourceType::Topic->value) {
                return $this->getTopicShareFileUrlsByAccessToken($shareEntity, $fileIds, $downloadMode, $fileVersions);
            }

            $fileScope = $this->resolveAccessTokenFileScope($shareEntity);
            $authorizedFileIds = $this->filterFileIdsByAllowedScope($fileIds, $fileScope['allowed_file_ids']);
            if (empty($authorizedFileIds)) {
                return [];
            }

            return $this->taskFileDomainService->getFileUrlsByProjectId(
                $authorizedFileIds,
                $fileScope['project_id'],
                $downloadMode,
                $fileVersions
            );
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
        if ((int) $requestDTO->getProjectId() <= 0) {
            return $this->batchMoveUserSpaceFiles($userAuthorization, $requestDTO);
        }
        $sourceProject = null;
        $targetProject = null;
        $targetParentId = null;

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

            // 3. Resolve and validate target parent directory
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

            $targetParentEntity = $this->taskFileDomainService->getById($targetParentId);
            if ($targetParentEntity === null || $targetParentEntity->getProjectId() !== $targetProject->getId()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                    trans('file.target_parent_not_in_target_project')
                );
            }

            // 4. Decide sync vs async path:
            // - Cross project / cross organization / keep-both conflicts / explicit positioning
            //   require background processing because they involve heavier work or richer ordering logic.
            // - Same project + same organization without keep-both / pre_file_id can be handled inline,
            //   the same way single-file move does, since we only need to update parent_id per row.
            $isCrossProject = $sourceProject->getId() !== $targetProject->getId();
            $isCrossOrganization = $sourceProject->getUserOrganizationCode() !== $targetProject->getUserOrganizationCode();
            $hasKeepBoth = ! empty($requestDTO->getKeepBothFileIds());
            $hasPreFileId = ! empty($requestDTO->getPreFileId());
            $preserveParentPath = $isCrossProject && $requestDTO->shouldPreserveParentPath();
            $shouldAsync = $isCrossProject || $isCrossOrganization || $hasKeepBoth || $hasPreFileId || $preserveParentPath;

            if (! $shouldAsync) {
                return $this->batchMoveFileSync(
                    $userAuthorization,
                    $sourceProject,
                    $targetProject,
                    $targetParentId,
                    $requestDTO->getFileIds()
                );
            }

            // 5. Async path: generate batch key for tracking
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

            $this->logger->info(sprintf('Batch move file request data, batchKey: %s', $batchKey), [
                'file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'source_project_id' => $sourceProject->getId(),
                'target_project_id' => $targetProject->getId(),
                'target_parent_id' => $targetParentId,
                'pre_file_id' => $requestDTO->getPreFileId(),
                'keep_both_file_ids' => $requestDTO->getKeepBothFileIds(),
                'preserve_parent_path' => $preserveParentPath,
            ]);

            // Create and publish batch move event
            $preFileId = $hasPreFileId ? (int) $requestDTO->getPreFileId() : null;
            $event = FileBatchMoveEvent::fromDTO(
                $batchKey,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $expandedFileIds,
                $targetProject->getId(),
                $sourceProject->getId(),
                $preFileId,
                $targetParentId,
                $requestDTO->getKeepBothFileIds(),
                $preserveParentPath
            );
            $publisher = new FileBatchMovePublisher($event);
            $this->producer->produce($publisher);

            // Return asynchronous response
            return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in batch move file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => $sourceProject?->getId(),
                'target_project_id' => $targetProject?->getId(),
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in batch move file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => $sourceProject?->getId(),
                'target_project_id' => $targetProject?->getId(),
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
        $sourceProject = null;
        $targetProject = null;

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
            $preserveParentPath = $sourceProject->getId() !== $targetProject->getId()
                && $requestDTO->shouldPreserveParentPath();

            // Expand directory file IDs to include all nested files
            $expandedFileIds = $this->expandDirectoryFileIds(
                $requestDTO->getFileIds(),
                $sourceProject->getId()
            );

            if (empty($expandedFileIds)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
            }

            $requestedFileIds = array_values(array_unique(array_map('intval', $requestDTO->getFileIds())));
            $resolvedRequestedFileIds = array_values(array_intersect($requestedFileIds, $expandedFileIds));
            $skippedRequestedFileIds = array_values(array_diff($requestedFileIds, $resolvedRequestedFileIds));

            if (! empty($skippedRequestedFileIds)) {
                $this->logger->warning('Batch copy request contains unavailable file ids, skipped in expansion', [
                    'requested_file_ids' => $requestDTO->getFileIds(),
                    'resolved_file_ids' => $expandedFileIds,
                    'skipped_file_ids' => $skippedRequestedFileIds,
                    'source_project_id' => $sourceProject->getId(),
                ]);
            }

            $this->logger->info('Expanded directory file IDs for batch copy', [
                'original_file_ids' => $requestDTO->getFileIds(),
                'expanded_file_ids' => $expandedFileIds,
                'original_count' => count($requestDTO->getFileIds()),
                'expanded_count' => count($expandedFileIds),
            ]);

            return $this->batchCopyAuthorizedFiles(
                $userAuthorization,
                $sourceProject,
                $targetProject,
                $expandedFileIds,
                $requestDTO->getTargetParentId(),
                $requestDTO->getPreFileId(),
                $requestDTO->getKeepBothFileIds(),
                $preserveParentPath
            );
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in batch copy file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => $sourceProject?->getId(),
                'target_project_id' => $targetProject?->getId(),
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in batch copy file', [
                'file_ids' => $requestDTO->getFileIds(),
                'source_project_id' => $sourceProject?->getId(),
                'target_project_id' => $targetProject?->getId(),
                'target_parent_id' => $requestDTO->getTargetParentId(),
                'error' => $e->getMessage(),
            ]);
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_COPY_FAILED, trans('file.batch_copy_failed'));
        }
    }

    /**
     * Execute a batch copy for files whose source access has already been authorized.
     *
     * The caller remains responsible for authorizing the source project and every
     * file ID. Target project and directory authorization must be completed before
     * calling this method.
     */
    public function batchCopyAuthorizedFiles(
        MagicUserAuthorization $userAuthorization,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        array $authorizedFileIds,
        string $targetParentId = '',
        string $preFileId = '',
        array $keepBothFileIds = [],
        bool $preserveParentPath = false
    ): array {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $expandedFileIds = array_values(array_unique(array_map('intval', $authorizedFileIds)));
        sort($expandedFileIds);

        if (empty($expandedFileIds)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }

        if (empty($targetParentId)) {
            $resolvedTargetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                projectId: $targetProject->getId(),
                workDir: $targetProject->getWorkDir(),
                userId: $dataIsolation->getCurrentUserId(),
                organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                projectOrganizationCode: $targetProject->getUserOrganizationCode()
            );
        } else {
            $resolvedTargetParentId = (int) $targetParentId;
        }

        $targetParentEntity = $this->taskFileDomainService->getById($resolvedTargetParentId);
        if ($targetParentEntity === null || ! $targetParentEntity->getIsDirectory()) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('file.target_parent_not_directory')
            );
        }
        if ($targetParentEntity->getProjectId() !== $targetProject->getId()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                trans('file.target_parent_not_in_target_project')
            );
        }

        $batchResourceId = sprintf(
            '%d:%d:%d:%s',
            $sourceProject->getId(),
            $targetProject->getId(),
            $resolvedTargetParentId,
            implode(',', $expandedFileIds)
        );
        $batchKey = $this->batchOperationStatusManager->generateBatchKey(
            FileBatchOperationStatusManager::OPERATION_COPY,
            $dataIsolation->getCurrentUserId(),
            md5($batchResourceId)
        );
        $this->batchOperationStatusManager->initializeTask(
            $batchKey,
            FileBatchOperationStatusManager::OPERATION_COPY,
            $dataIsolation->getCurrentUserId(),
            count($expandedFileIds)
        );

        $event = FileBatchCopyEvent::fromDTO(
            $batchKey,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode(),
            $expandedFileIds,
            $targetProject->getId(),
            $sourceProject->getId(),
            ! empty($preFileId) ? (int) $preFileId : null,
            $resolvedTargetParentId,
            $keepBothFileIds,
            $sourceProject->getId() !== $targetProject->getId() && $preserveParentPath
        );
        $this->producer->produce(new FileBatchCopyPublisher($event));

        return FileBatchOperationResponseDTO::createAsyncProcessing($batchKey)->toArray();
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

        try {
            // 1. Permission verification and file existence check (using MagicFS)
            $fileEntity = $this->magicFSFileDomainService->getFileById((string) $fileId);

            // 2. 项目文件使用角色鉴权，用户空间文件使用 owner 鉴权。
            $projectEntity = $this->getAccessibleProjectForTaskFile(
                $fileEntity,
                $userAuthorization,
                MemberRole::EDITOR,
            );
            $storageOrganizationCode = $projectEntity?->getUserOrganizationCode()
                ?? $fileEntity->getOrganizationCode();
            $workDir = $projectEntity?->getWorkDir()
                ?? WorkDirectoryUtil::getUserWorkDir($fileEntity->getUserId());

            // 3. Check file editing status (if force_replace is false)
            // TODO: Implement editing status check logic
            // if (!$requestDTO->getForceReplace()) {
            //     $editingUsers = $this->getFileEditingUsers($fileId);
            //     if (!empty($editingUsers)) {
            //         ExceptionBuilder::throw(...);
            //     }
            // }

            // 4. Determine new file name (optional)
            $newFileName = ! empty($requestDTO->getFileName())
                ? $requestDTO->getFileName()
                : null;  // null means keep original filename

            // 5. Detect cross-type replace (for version creation and event)
            if ($newFileName === null || $newFileName === $fileEntity->getFileName()) {
                // file_key is an opaque storage identifier and cannot represent the file name.
                $newFileExtension = pathinfo($fileEntity->getFileName(), PATHINFO_EXTENSION);
            } else {
                // A different file_name means replacing and renaming the current file.
                // The domain service checks whether the target name conflicts with another file.
                $newFileExtension = pathinfo($newFileName, PATHINFO_EXTENSION);
            }
            $oldFileExtension = $fileEntity->getFileExtension();
            $isCrossTypeReplace = ($oldFileExtension !== $newFileExtension);

            Db::beginTransaction();
            try {
                // 6. Create version snapshot (before replacement)
                $versionEntity = null;
                $canCreateVersion = $this->taskFileVersionDomainService->canCreateVersion($fileEntity);
                if ($canCreateVersion) {
                    $versionEntity = $this->taskFileVersionDomainService->createFileVersion(
                        $storageOrganizationCode,
                        $fileEntity,
                        $isCrossTypeReplace ? 2 : 1  // Cross-type replace uses special marker
                    );
                }

                if ($canCreateVersion && empty($versionEntity)) {
                    $this->logger->warning('Failed to create version snapshot before replace', [
                        'file_id' => $fileId,
                    ]);
                }

                // 7. Call MagicFS atomic operation (core operation delegated to MagicFS)
                $updatedFile = $this->taskFileDomainService->replaceFile(
                    (string) $fileId,
                    $requestDTO->getFileKey(),
                    $newFileName
                );

                Db::commit();

                $this->logger->info('File replaced successfully', [
                    'file_id' => $fileId,
                    'old_file_key' => $fileEntity->getFileKey(),
                    'new_file_key' => $updatedFile->getFileKey(),
                    'version_id' => $versionEntity?->getId(),
                    'is_cross_type_replace' => $isCrossTypeReplace,
                ]);

                // 8. Publish event
                // AttachmentsProcessedEventSubscriber reacts to FileReplacedEvent and handles
                // display_config re-parsing when the replaced file is a metadata file.
                if ($updatedFile->isProjectFile()) {
                    $fileReplacedEvent = new FileReplacedEvent(
                        $updatedFile,
                        $versionEntity,
                        $userAuthorization,
                        $isCrossTypeReplace,
                    );
                    $this->eventDispatcher->dispatch($fileReplacedEvent);
                }

                // 9. Return result
                return TaskFileItemDTO::fromEntity($updatedFile, $workDir)->toArray();
            } catch (Throwable $e) {
                Db::rollBack();

                $this->logger->error('Failed to replace file, transaction rolled back', [
                    'file_id' => $fileId,
                    'source_key' => $requestDTO->getFileKey(),
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                throw $e;
            }
        } catch (BusinessException $e) {
            $this->logger->warning('Business logic error in replace file', [
                'file_id' => $fileId,
                'source_key' => $requestDTO->getFileKey(),
                'error' => $e->getMessage(),
                'code' => $e->getCode(),
            ]);
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('System error in replace file', [
                'file_id' => $fileId,
                'source_key' => $requestDTO->getFileKey(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
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
     * Scan a directory in object storage for .wav files and persist any new ones
     * to the task file table.
     *
     * @param RequestContext $requestContext Request context with user authorization
     * @param ScanWavFilesRequestDTO $requestDTO Request parameters
     * @return array Result summary
     */
    public function scanWavFiles(RequestContext $requestContext, ScanWavFilesRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $orgCode = $userAuthorization->getOrganizationCode();
        $projectId = (int) $requestDTO->getProjectId();
        $relativePath = $requestDTO->getRelativePath();

        // Validate that the project is accessible by the current user
        $this->getAccessibleProject($projectId, $userId, $orgCode);

        // Find the directory entity by relative path
        $dirEntity = $this->taskFileDomainService->findEntityByRelativePath($projectId, $relativePath);
        if ($dirEntity === null) {
            return ['scanned' => 0, 'inserted' => 0, 'message' => 'Directory not found'];
        }

        // Check that the directory file_key contains the last segment of the relative path (file_name)
        $fileName = basename(rtrim($relativePath, '/'));
        if ($fileName !== '' && ! str_contains($dirEntity->getFileKey(), $fileName)) {
            return ['scanned' => 0, 'inserted' => 0, 'message' => 'File key does not match directory name'];
        }

        // Scan object storage using the directory's file_key as the prefix.
        // Strip the orgCode/appId prefix from file_key because getFilesFromCloudStorage
        // (via listObjectsByCredential) prepends orgCode/appId internally.
        //
        // NOTE: getFilesFromCloudStorage → listObjectsByCredential → TosSimpleUpload
        // defaults to max-keys=1000 with no pagination loop. If a directory contains
        // more than 1000 files, only the first 1000 are returned. is_truncated is also
        // not surfaced by TosSimpleUpload, so the caller cannot detect truncation.
        // For the .wav scanning use case this is acceptable — 1000 files per directory
        // is a reasonable upper bound. If needed, add pagination in getFilesFromCloudStorage.
        $appId = config('kk_brd_service.app_id');
        $orgPrefix = "{$orgCode}/{$appId}/";
        $objectPrefix = str_starts_with($dirEntity->getFileKey(), $orgPrefix)
            ? substr($dirEntity->getFileKey(), strlen($orgPrefix))
            : $dirEntity->getFileKey();
        $cloudFiles = $this->fileDomainService->getFilesFromCloudStorage($orgCode, $objectPrefix, StorageBucketType::SandBox);

        // Filter only .wav files
        $wavFiles = array_filter($cloudFiles, static function ($fileInfo) {
            return strtolower(pathinfo($fileInfo->getFilename(), PATHINFO_EXTENSION)) === 'wav';
        });

        if (empty($wavFiles)) {
            return ['scanned' => 0, 'inserted' => 0, 'message' => 'No WAV files found'];
        }

        // Build file info list for .wav files
        $wavFileList = [];
        foreach ($wavFiles as $fileInfo) {
            $wavFileList[] = [
                'file_name' => $fileInfo->getFilename(),
                'file_key' => $fileInfo->getKey(),
                'file_size' => $fileInfo->getSize() ?? 0,
            ];
        }

        $wavFileNames = array_column($wavFileList, 'file_name');

        // Query existing records under this parent directory to avoid duplicates
        $existingNames = $this->taskFileDomainService->getExistingWavFileNamesByParentId(
            $dirEntity->getFileId(),
            $wavFileNames
        );

        $existingSet = array_flip($existingNames);

        // Determine which files are new
        $newWavFiles = array_filter($wavFileList, static function ($fileInfo) use ($existingSet) {
            return ! isset($existingSet[$fileInfo['file_name']]);
        });

        if (empty($newWavFiles)) {
            return ['scanned' => count($wavFileList), 'inserted' => 0, 'message' => 'All WAV files already exist'];
        }

        $dataIsolation = DataIsolation::create($orgCode, $userId);

        $this->taskFileDomainService->batchInsertWavFiles(
            $dataIsolation,
            $projectId,
            $dirEntity->getFileId(),
            array_values($newWavFiles)
        );

        // The inserted rows announced themselves; the directory only needs its
        // listing version moved so MagicFS clients see the directory as stale.
        $this->magicFSFileDomainService->bumpFileTreeVersions([$dirEntity->getFileId()]);

        return [
            'scanned' => count($wavFileList),
            'inserted' => count($newWavFiles),
            'message' => 'WAV files scanned and saved successfully',
        ];
    }

    /**
     * Update the source of a task file.
     *
     * @param RequestContext $requestContext Request context
     * @param UpdateFileSourceRequestDTO $requestDTO Request DTO containing file_id and source
     * @return array Updated file info
     */
    public function updateFileSource(RequestContext $requestContext, UpdateFileSourceRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        $fileId = $requestDTO->getFileId();
        $source = TaskFileSource::fromValue($requestDTO->getSource());

        // 鉴权前置：项目空间文件校验项目编辑权限，用户空间文件校验文件 owner。
        $fileEntity = $this->taskFileDomainService->getById($fileId);
        if ($fileEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.file_not_found'));
        }
        $this->getAccessibleProjectForTaskFile($fileEntity, $userAuthorization, MemberRole::EDITOR);

        $fileEntity = $this->taskFileDomainService->updateFileSource($fileId, $source);

        return [
            'file_id' => $fileEntity->getFileId(),
            'source' => $fileEntity->getSource()->value,
        ];
    }

    /**
     * @param array<int, null|TaskFileEntity> $fileEntities
     */
    protected function dispatchFileUploadedEvents(array $fileEntities, MagicUserAuthorization $userAuthorization): void
    {
        foreach ($fileEntities as $fileEntity) {
            $this->dispatchFileUploadedEvent($fileEntity, $userAuthorization);
        }
    }

    protected function dispatchFileUploadedEvent(?TaskFileEntity $fileEntity, MagicUserAuthorization $userAuthorization): void
    {
        if ($fileEntity === null || ! $fileEntity->isProjectFile()) {
            return;
        }

        $fileUploadedEvent = new FileUploadedEvent(
            $fileEntity,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode()
        );
        $this->eventDispatcher->dispatch($fileUploadedEvent);
    }

    /**
     * Publish a batch-deleted event from a heterogeneous list of TaskFileEntity instances.
     *
     * The helper splits the entities into files and directories so the event payload
     * matches the constructor contract of {@see FilesBatchDeletedEvent}. Non-entity
     * elements (e.g. nulls returned by some lookups) are filtered out defensively.
     *
     * @param array<int, null|TaskFileEntity> $entities
     */
    protected function dispatchFilesBatchDeletedEvent(int $projectId, array $entities, MagicUserAuthorization $userAuthorization): void
    {
        $files = [];
        $directories = [];
        foreach ($entities as $entity) {
            if (! $entity instanceof TaskFileEntity) {
                continue;
            }
            if ($entity->getIsDirectory()) {
                $directories[] = $entity;
            } else {
                $files[] = $entity;
            }
        }

        $firstEntity = $files[0] ?? $directories[0] ?? null;
        if ($firstEntity === null || ! $firstEntity->isProjectFile()) {
            return;
        }

        $this->eventDispatcher->dispatch(new FilesBatchDeletedEvent(
            $files,
            $directories,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode(),
            $projectId,
            $userAuthorization,
        ));
    }

    /**
     * @return array{project_id:int, allowed_file_ids:null|int[]}
     */
    private function resolveAccessTokenFileScope(ResourceShareEntity $shareEntity): array
    {
        return match ($shareEntity->getResourceType()) {
            ResourceType::Project->value => [
                'project_id' => (int) $shareEntity->getProjectId(),
                'allowed_file_ids' => null,
            ],
            ResourceType::FileCollection->value,
            ResourceType::File->value => $this->resolveFileCollectionShareFileScope($shareEntity),
            default => ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported'),
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getTopicShareFileUrlsByAccessToken(ResourceShareEntity $shareEntity, array $fileIds, string $downloadMode, array $fileVersions): array
    {
        $topicEntity = $this->topicDomainService->getTopicWithDeleted((int) $shareEntity->getResourceId());
        if (empty($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $projectId = $topicEntity->getProjectId();
        if ($projectId <= 0) {
            return [];
        }

        $authorizedFileIds = $shareEntity->isViewFileListEnabled()
            ? $this->normalizeFileIds($fileIds)
            : $this->filterFileIdsByTopicScope($fileIds, $projectId, (int) $shareEntity->getResourceId());

        if (empty($authorizedFileIds)) {
            return [];
        }

        return $this->taskFileDomainService->getFileUrlsByProjectId(
            $authorizedFileIds,
            $projectId,
            $downloadMode,
            $fileVersions
        );
    }

    /**
     * @return array{project_id:int, allowed_file_ids:int[]}
     */
    private function resolveFileCollectionShareFileScope(ResourceShareEntity $shareEntity): array
    {
        $collectionId = (int) $shareEntity->getResourceId();
        $projectId = $this->fileCollectionDomainService->getProjectIdByCollectionId($collectionId);
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_collection_empty_or_not_found');
        }

        return [
            'project_id' => $projectId,
            'allowed_file_ids' => $this->getAllowedFileIdsFromCollection($collectionId, $projectId),
        ];
    }

    /**
     * @param null|int[] $allowedFileIds
     * @return int[]
     */
    private function filterFileIdsByAllowedScope(array $fileIds, ?array $allowedFileIds): array
    {
        $normalizedFileIds = $this->normalizeFileIds($fileIds);
        if ($allowedFileIds === null) {
            return $normalizedFileIds;
        }

        $allowedFileIdMap = array_fill_keys($this->normalizeFileIds($allowedFileIds), true);
        $authorizedFileIds = [];
        foreach ($normalizedFileIds as $fileId) {
            if (isset($allowedFileIdMap[$fileId])) {
                $authorizedFileIds[] = $fileId;
            }
        }

        return $authorizedFileIds;
    }

    /**
     * @return int[]
     */
    private function filterFileIdsByTopicScope(array $fileIds, int $projectId, int $topicId): array
    {
        $normalizedFileIds = $this->normalizeFileIds($fileIds);
        if (empty($normalizedFileIds)) {
            return [];
        }

        $fileEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $normalizedFileIds);
        if (empty($fileEntities)) {
            return [];
        }

        $topicFileIdMap = [];
        foreach ($fileEntities as $fileEntity) {
            if ($fileEntity instanceof TaskFileEntity
                && $fileEntity->getProjectId() === $projectId
                && $fileEntity->getTopicId() === $topicId) {
                $topicFileIdMap[$fileEntity->getFileId()] = true;
            }
        }

        $authorizedFileIds = [];
        foreach ($normalizedFileIds as $fileId) {
            if (isset($topicFileIdMap[$fileId])) {
                $authorizedFileIds[] = $fileId;
            }
        }

        return $authorizedFileIds;
    }

    /**
     * @return int[]
     */
    private function normalizeFileIds(array $fileIds): array
    {
        $normalizedFileIds = [];
        foreach ($fileIds as $fileId) {
            $normalizedFileId = (int) $fileId;
            if ($normalizedFileId > 0) {
                $normalizedFileIds[$normalizedFileId] = $normalizedFileId;
            }
        }

        return array_values($normalizedFileIds);
    }

    /**
     * @param TaskFileEntity[] $fileEntities
     * @return int[]
     */
    private function getAllowedFileIdsFromEntities(array $fileEntities): array
    {
        $allowedFileIds = [];
        foreach ($fileEntities as $fileEntity) {
            $fileId = $fileEntity->getFileId();
            $allowedFileIds[] = $fileId;

            if ($fileEntity->getIsDirectory()) {
                $allowedFileIds = array_merge($allowedFileIds, $this->collectSubtreeFileIdsByMagicFs($fileId));
            }
        }

        return array_values(array_unique($allowedFileIds));
    }

    /**
     * Get all allowed file IDs from a file collection.
     * This includes files directly in the collection AND all child files of directories in the collection.
     *
     * @param int $collectionId File collection ID
     * @param int $projectId Project ID
     * @return int[] Array of allowed file IDs
     */
    private function getAllowedFileIdsFromCollection(int $collectionId, int $projectId): array
    {
        $collectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($collectionItems)) {
            return [];
        }

        $sharedFileIds = array_map(fn ($item) => (int) $item->getFileId(), $collectionItems);
        $sharedEntities = $this->taskFileDomainService->findFilesByProjectIdAndIds($projectId, $sharedFileIds);

        return $this->getAllowedFileIdsFromEntities($sharedEntities);
    }

    /**
     * Synchronous batch move for the same project + same organization scenario.
     *
     * Mirrors the inline branch of single-file moveFile(): each top-level file id is updated via
     * moveFileWithCheck() (parent_id only), and a FileMovedEvent is dispatched per file so downstream
     * subscribers (display_config cleanup, notifications, etc.) behave the same as a single move.
     *
     * @param MagicUserAuthorization $userAuthorization Caller authorization
     * @param ProjectEntity $sourceProject Source project (== target project here)
     * @param ProjectEntity $targetProject Target project
     * @param int $targetParentId Resolved target parent directory id
     * @param array $fileIds Top-level file ids requested by client (may contain directories)
     * @return array Sync response payload
     */
    private function batchMoveFileSync(
        MagicUserAuthorization $userAuthorization,
        ProjectEntity $sourceProject,
        ProjectEntity $targetProject,
        int $targetParentId,
        array $fileIds
    ): array {
        $movedItems = [];

        // Build a lightweight authorization clone for event payload, matching single-file move().
        $movedUserAuth = new MagicUserAuthorization();
        $movedUserAuth->setId($userAuthorization->getId());
        $movedUserAuth->setOrganizationCode($userAuthorization->getOrganizationCode());

        foreach ($fileIds as $rawFileId) {
            $intFileId = (int) $rawFileId;
            if ($intFileId <= 0) {
                continue;
            }

            // Load source file and ensure it belongs to the source project.
            $sourceFileEntity = $this->taskFileDomainService->getUserFileEntityNoUser($intFileId);
            if ($sourceFileEntity->getProjectId() !== $sourceProject->getId()) {
                ExceptionBuilder::throw(
                    SuperAgentErrorCode::FILE_PERMISSION_DENIED,
                    trans('file.target_parent_not_in_target_project')
                );
            }

            // Already under the target parent: skip the update but still return the entity to keep
            // a stable response shape for the client.
            if ($sourceFileEntity->getParentId() === $targetParentId) {
                $relativeFilePath = $this->buildRelativeFilePathForEntity($sourceFileEntity, $targetProject->getId());
                $movedItems[] = TaskFileItemDTO::fromEntity(
                    $sourceFileEntity,
                    $targetProject->getWorkDir(),
                    $relativeFilePath
                )->toArray();
                continue;
            }

            $oldParentId = $sourceFileEntity->getParentId();
            // Pre-detect overwritten file before moveFileWithCheck silently handles it via MagicFS
            $syncOverwrittenFile = null;
            if (! $sourceFileEntity->getIsDirectory()) {
                $targetParentIdForCheck = $targetParentId <= 0 ? null : $targetParentId;
                $syncCandidate = $this->taskFileDomainService->getByProjectParentAndName(
                    $sourceFileEntity->getProjectId(),
                    $targetParentIdForCheck,
                    $sourceFileEntity->getFileName()
                );
                if ($syncCandidate !== null && $syncCandidate->getFileId() !== $sourceFileEntity->getFileId() && ! $syncCandidate->getIsDirectory()) {
                    $syncOverwrittenFile = $syncCandidate;
                }
            }
            $updatedFileEntity = $this->taskFileDomainService->moveFileWithCheck(
                (string) $sourceFileEntity->getFileId(),
                (string) $targetParentId,
                true
            );

            $this->eventDispatcher->dispatch(new FileMovedEvent($updatedFileEntity, $movedUserAuth, $oldParentId, $syncOverwrittenFile));

            // Re-fetch with the updated row so the response reflects the latest state.
            $newFileEntity = $this->taskFileDomainService->getById($intFileId);
            if ($newFileEntity === null) {
                continue;
            }

            $relativeFilePath = $this->buildRelativeFilePathForEntity($newFileEntity, $targetProject->getId());
            $movedItems[] = TaskFileItemDTO::fromEntity(
                $newFileEntity,
                $targetProject->getWorkDir(),
                $relativeFilePath
            )->toArray();
        }

        $this->logger->info('Batch move file sync completed', [
            'source_project_id' => $sourceProject->getId(),
            'target_project_id' => $targetProject->getId(),
            'target_parent_id' => $targetParentId,
            'requested_file_count' => count($fileIds),
            'moved_file_count' => count($movedItems),
        ]);

        return FileBatchOperationResponseDTO::createSyncSuccess($movedItems)->toArray();
    }

    /**
     * 构建单个文件实体的相对路径.
     * 通过 parent_id 链向上遍历，拼接完整的目录层级路径.
     *
     * @param TaskFileEntity $entity 文件实体
     * @param int $projectId 项目ID（用于过滤查询范围）
     * @return string 相对文件路径，如 /目录A/目录B/文件名.txt
     */
    private function buildRelativeFilePathForEntity(TaskFileEntity $entity, int $projectId): string
    {
        $filesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds(
            [$entity->getFileId()],
            $projectId
        );
        $fileMap = RelativeFilePathUtil::indexByFileId($filesWithParents);

        return RelativeFilePathUtil::buildPathByParentChain($entity, $fileMap);
    }

    /**
     * 在同一用户空间内移动单个文件或目录。
     */
    private function moveUserSpaceFile(
        MagicUserAuthorization $authorization,
        TaskFileEntity $source,
        int $targetParentId,
        ?int $targetProjectId,
        array $keepBothFileIds,
    ): array {
        if ($targetParentId <= 0 || $targetProjectId !== null || $keepBothFileIds !== []) {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'file.operation_failed');
        }

        $this->getAccessibleProjectForTaskFile($source, $authorization, MemberRole::EDITOR);
        $targetParent = $this->getUserSpaceDirectory($targetParentId, $authorization);
        $updated = $this->taskFileDomainService->moveFileWithCheck(
            (string) $source->getFileId(),
            (string) $targetParent->getFileId(),
        );
        $workDir = WorkDirectoryUtil::getUserWorkDir($authorization->getId());
        $relativePath = $this->buildRelativeFilePathForEntity($updated, 0);
        $item = TaskFileItemDTO::fromEntity($updated, $workDir, $relativePath)->toArray();

        return FileBatchOperationResponseDTO::createSyncSuccess($item)->toArray();
    }

    /**
     * 在同一用户空间内同步批量移动文件或目录。
     */
    private function batchMoveUserSpaceFiles(
        MagicUserAuthorization $authorization,
        BatchMoveFileRequestDTO $requestDTO,
    ): array {
        if ($requestDTO->getTargetProjectId() !== ''
            || $requestDTO->getKeepBothFileIds() !== []
            || $requestDTO->getPreFileId() !== '') {
            ExceptionBuilder::throw(SuperAgentErrorCode::VALIDATE_FAILED, 'file.operation_failed');
        }

        $fileIds = array_values(array_unique(array_map('intval', $requestDTO->getFileIds())));
        $targetParentId = (int) $requestDTO->getTargetParentId();
        $entities = $this->taskFileDomainService->getFilesByIds(array_merge($fileIds, [$targetParentId]));
        $entityMap = [];
        foreach ($entities as $entity) {
            $entityMap[$entity->getFileId()] = $entity;
        }

        $targetParent = $entityMap[$targetParentId] ?? null;
        if ($targetParent === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
        }
        $this->getUserSpaceDirectory($targetParentId, $authorization);

        $workDir = WorkDirectoryUtil::getUserWorkDir($authorization->getId());
        $movedItems = [];
        foreach ($fileIds as $fileId) {
            $source = $entityMap[$fileId] ?? null;
            if ($source === null || $source->isProjectFile()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
            $this->getAccessibleProjectForTaskFile($source, $authorization, MemberRole::EDITOR);
            $updated = $this->taskFileDomainService->moveFileWithCheck(
                (string) $source->getFileId(),
                (string) $targetParentId,
            );
            $relativePath = $this->buildRelativeFilePathForEntity($updated, 0);
            $movedItems[] = TaskFileItemDTO::fromEntity($updated, $workDir, $relativePath)->toArray();
        }

        return FileBatchOperationResponseDTO::createSyncSuccess($movedItems)->toArray();
    }

    /**
     * 获取已通过 owner 鉴权的用户空间目录。
     */
    private function getUserSpaceDirectory(
        int $fileId,
        MagicUserAuthorization $authorization,
    ): TaskFileEntity {
        $directory = $this->taskFileDomainService->getById($fileId);
        if ($directory === null || ! $directory->getIsDirectory() || $directory->isProjectFile()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
        }

        $this->getAccessibleProjectForTaskFile($directory, $authorization, MemberRole::EDITOR);
        return $directory;
    }

    /**
     * 校验用户空间上传对象位于当前用户工作目录内。
     */
    private function assertUserSpaceFileKey(
        string $organizationCode,
        string $workDir,
        string $fileKey,
    ): void {
        $fullPrefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        $fullWorkDir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $workDir);
        if (! WorkDirectoryUtil::checkEffectiveFileKey($fullWorkDir, $fileKey)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
        }
    }

    /**
     * 构建项目空间或用户空间的文件操作锁名称。
     */
    private function getFileSpaceLockName(int $projectId, string $userId): string
    {
        if ($projectId > 0) {
            return WorkDirectoryUtil::getLockerKey($projectId);
        }

        return sprintf('user_file_space:%s', $userId);
    }

    /**
     * 批量保存用户空间文件，并按父目录 owner 权限限制写入范围。
     */
    private function batchSaveUserSpaceFiles(
        MagicUserAuthorization $authorization,
        BatchSaveProjectFilesRequestDTO $requestDTO,
    ): array {
        $defaultParentId = $requestDTO->getParentId();
        $normalizedFiles = [];
        $parentIds = [];
        foreach ($requestDTO->getFiles() as $fileData) {
            if (! is_array($fileData)
                || empty($fileData['file_key'])
                || empty($fileData['file_name'])) {
                continue;
            }

            $parentId = (int) $this->resolveBatchSaveFileParentId($fileData, $defaultParentId);
            if ($parentId <= 0) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
            }
            $fileData['project_id'] = '0';
            $fileData['parent_id'] = (string) $parentId;
            $normalizedFiles[] = $fileData;
            $parentIds[$parentId] = $parentId;
        }

        $parentEntities = $this->taskFileDomainService->getFilesByIds(array_values($parentIds));
        $parentMap = [];
        foreach ($parentEntities as $parentEntity) {
            if (! $parentEntity->getIsDirectory() || $parentEntity->isProjectFile()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.permission_denied');
            }
            $this->getAccessibleProjectForTaskFile($parentEntity, $authorization, MemberRole::EDITOR);
            $parentMap[$parentEntity->getFileId()] = $parentEntity;
        }
        if (count($parentMap) !== count($parentIds)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, trans('file.parent_file_not_found'));
        }

        $workDir = WorkDirectoryUtil::getUserWorkDir($authorization->getId());
        $organizationCode = $authorization->getOrganizationCode();
        $lockName = $this->getFileSpaceLockName(0, $authorization->getId());
        $lockOwner = $authorization->getId();
        if (! $this->locker->spinLock($lockName, $lockOwner, 30)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, trans('file.batch_save_locked'));
        }

        Db::beginTransaction();
        try {
            $savedFiles = [];
            foreach ($normalizedFiles as $fileData) {
                try {
                    $this->assertUserSpaceFileKey($organizationCode, $workDir, (string) $fileData['file_key']);
                    $fileRequestDTO = SaveProjectFileRequestDTO::fromRequest($fileData);
                    $taskFileEntity = $fileRequestDTO->toEntity();
                    $taskFileEntity->setProjectId(0);
                    $taskFileEntity->setParentId((int) $fileData['parent_id']);
                    $taskFileEntity->setSpaceType('user');

                    $savedEntity = $this->taskFileDomainService->upsertProjectFileNode(
                        new UpsertProjectFileNodeDTO(
                            projectId: 0,
                            projectWorkDir: $workDir,
                            projectOrganizationCode: $organizationCode,
                            operatorUserId: $authorization->getId(),
                            operatorOrganizationCode: $organizationCode,
                            taskFileEntity: $taskFileEntity,
                            storageTypeOverride: FileSpaceType::resolveStorageType($taskFileEntity->getSpaceType())->value,
                        ),
                    );
                    $relativePath = $this->buildRelativeFilePathForEntity($savedEntity, 0);
                    $savedFiles[] = TaskFileItemDTO::fromEntity($savedEntity, $workDir, $relativePath);
                } catch (Throwable $throwable) {
                    $this->logger->warning('批量保存用户空间文件时跳过失败文件', [
                        'file_key' => $fileData['file_key'],
                        'file_name' => $fileData['file_name'],
                        'error' => $throwable->getMessage(),
                    ]);
                }
            }
            Db::commit();

            return $savedFiles;
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * 通过 file_ids 批量查询文件实体，按 project_id 分组分别做权限校验和 URL 生成，合并结果返回.
     */
    private function getFileUrlsGroupedByProject(MagicUserAuthorization $authorization, array $fileIds, string $downloadMode, array $options, array $fileVersions): array
    {
        $fileEntities = $this->taskFileAuthorizationService->authorizeFilesByIds(
            $authorization,
            $fileIds,
            MemberRole::VIEWER,
            true,
        );
        if (empty($fileEntities)) {
            return [];
        }

        // 按 project_id 分组保留文件实体，避免重复查询项目权限。
        $fileEntitiesByProject = [];
        foreach ($fileEntities as $fileEntity) {
            $fileEntitiesByProject[$fileEntity->getProjectId()][] = $fileEntity;
        }

        $result = [];
        foreach ($fileEntitiesByProject as $groupProjectId => $groupFileEntities) {
            $groupFileIds = array_map(
                static fn (TaskFileEntity $fileEntity): string => (string) $fileEntity->getFileId(),
                $groupFileEntities
            );

            if ($groupFileEntities[0]->isProjectFile()) {
                $groupProject = $this->projectDomainService->getProjectNotUserId((int) $groupProjectId);
                if ($groupProject === null) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
                }
                $organizationCode = $groupProject->getUserOrganizationCode();
            } else {
                $organizationCode = $groupFileEntities[0]->getOrganizationCode();
            }

            $urls = $this->taskFileDomainService->getFileUrls(
                $organizationCode,
                (int) $groupProjectId,
                $groupFileIds,
                $downloadMode,
                $options,
                $fileVersions,
                true
            );

            $result = array_merge($result, $urls);
        }

        return $result;
    }

    /**
     * Resolve parent_id with priority: file-level > top-level > root.
     *
     * @param array<string, mixed> $fileData
     */
    private function resolveBatchSaveFileParentId(array $fileData, string $defaultParentId): string
    {
        if (! array_key_exists('parent_id', $fileData) || $fileData['parent_id'] === null || $fileData['parent_id'] === '') {
            return $defaultParentId;
        }

        return (string) $fileData['parent_id'];
    }

    /**
     * Validate top-level batch-save parent directory.
     */
    private function validateBatchSaveParentDirectory(string $parentId, int $projectId): void
    {
        if ($parentId === '' || $parentId === '0') {
            return;
        }

        $parentFileEntity = $this->taskFileDomainService->getById((int) $parentId);
        if ($parentFileEntity === null || $parentFileEntity->getProjectId() !== $projectId) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_NOT_FOUND,
                trans('file.not_found')
            );
        }

        if (! $parentFileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(
                SuperAgentErrorCode::FILE_SAVE_FAILED,
                trans('file.target_parent_not_directory')
            );
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
     * @param array $fileIds Original file IDs (may contain directories)
     * @param int $projectId Project ID
     * @return array Expanded file IDs (includes all nested files from directories)
     */
    private function expandDirectoryFileIds(array $fileIds, int $projectId): array
    {
        $allFileIds = [];

        // Get all file entities
        $fileEntities = $this->taskFileDomainService->getProjectFilesByIds($projectId, $fileIds);

        foreach ($fileEntities as $fileEntity) {
            // Always include the file/directory itself
            $allFileIds[] = $fileEntity->getFileId();

            // If it's a directory, expand to get all nested files
            if ($fileEntity->getIsDirectory()) {
                $nestedFileIds = $this->collectSubtreeFileIdsByMagicFs($fileEntity->getFileId());

                // Merge nested file IDs
                if (! empty($nestedFileIds)) {
                    $allFileIds = array_merge($allFileIds, $nestedFileIds);
                }
            }
        }

        // Remove duplicates and reindex
        return array_values(array_unique($allFileIds));
    }

    /**
     * Collect subtree file IDs from MagicFS file tree.
     *
     * @return array<int>
     */
    private function collectSubtreeFileIdsByMagicFs(int $fileId): array
    {
        $fileTree = $this->magicFSFileDomainService->getFileTree((string) $fileId);

        $fileIds = [];
        if (isset($fileTree['root']) && $fileTree['root'] instanceof TaskFileEntity) {
            $fileIds[] = $fileTree['root']->getFileId();
        }

        if (isset($fileTree['children']) && is_array($fileTree['children'])) {
            foreach ($fileTree['children'] as $childEntity) {
                if ($childEntity instanceof TaskFileEntity) {
                    $fileIds[] = $childEntity->getFileId();
                }
            }
        }

        return array_values(array_unique($fileIds));
    }
}
