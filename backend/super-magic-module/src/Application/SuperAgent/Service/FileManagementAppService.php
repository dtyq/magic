<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchDeleteFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteDirectoryRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TopicUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

class FileManagementAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly FileAppService $fileAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
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
                $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
                $workDir = $projectEntity->getWorkDir();
                if (empty($workDir)) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, trans('project.work_dir.not_found'));
                }
            } else {
                // 情况2：无项目ID，使用雪花ID生成临时项目ID
                $tempProjectId = IdGenerator::getSnowId();
                $workDir = WorkDirectoryUtil::getWorkDir($userId, $tempProjectId);
            }

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::SandBox->value;

            return $this->fileAppService->getStsTemporaryCredential(
                $userAuthorization,
                $storageType,
                $workDir,
                $expires,
                false
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
            $workDir = WorkDirectoryUtil::getTopicUploadDir($userId, $topicEntity->getProjectId(), $topicEntity->getId());

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::SandBox->value;

            return $this->fileAppService->getStsTemporaryCredential(
                $userAuthorization,
                $storageType,
                $workDir,
                $expires
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

        Db::beginTransaction();
        try {
            $projectId = $requestDTO->getProjectId();

            if (empty($requestDTO->getFileKey())) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('validation.file_key_required'));
            }

            if (empty($requestDTO->getFileName())) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('validation.file_name_required'));
            }

            if ($requestDTO->getFileSize() <= 0) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, trans('validation.file_size_required'));
            }

            // 校验项目归属权限 - 确保用户只能保存到自己的项目
            $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getProjectId(), $dataIsolation->getCurrentUserId());
            if ($projectEntity->getUserId() != $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, trans('project.project_access_denied'));
            }

            if (empty($requestDTO->getParentId())) {
                $parentId = $this->taskFileDomainService->findOrCreateDirectoryAndGetParentId(
                    projectId: (int) $projectId,
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                    fullFileKey: $requestDTO->getFileKey(),
                    workDir: $projectEntity->getWorkDir()
                );
                $requestDTO->setParentId($parentId);
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
                $requestDTO->getParentId(),
                $requestDTO->getPreFileId(),
                (int) $requestDTO->getProjectId()
            );

            // 设置排序值
            $taskFileEntity->setSort($sortValue);

            // 调用领域服务保存文件
            $savedEntity = $this->taskFileDomainService->saveProjectFile(
                $dataIsolation,
                $taskFileEntity
            );

            Db::commit();

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
            $parentId = (int) $requestDTO->getParentId();

            // 校验项目归属权限 - 确保用户只能在自己的项目中创建文件
            $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
            if ($projectEntity->getUserId() != $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, trans('project.project_access_denied'));
            }

            // 如果 parent_id 为空，则设置为根目录
            if (empty($parentId)) {
                $parentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    $projectId,
                    $projectEntity->getWorkDir(),
                    $dataIsolation->getCurrentUserId(),
                    $dataIsolation->getCurrentOrganizationCode()
                );
            }

            // 通过领域服务计算排序值
            $sortValue = $this->taskFileDomainService->calculateSortForNewFile(
                $parentId === 0 ? null : $parentId,
                $requestDTO->getPreFileId(),
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
            $fileEntity = $this->taskFileDomainService->getUserFileEntity($dataIsolation, $fileId);
            $projectEntity = $this->projectDomainService->getProject($fileEntity->getProjectId(), $dataIsolation->getCurrentUserId());
            if ($fileEntity->getIsDirectory()) {
                $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles($dataIsolation, $projectEntity->getWorkDir(), $projectEntity->getId(), $fileEntity->getFileKey());
            } else {
                $deletedCount = 1;
                $this->taskFileDomainService->deleteProjectFiles($dataIsolation, $fileEntity, $projectEntity->getWorkDir());
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
            $projectEntity = $this->projectDomainService->getProject($projectId, $userId);

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
            $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles($dataIsolation, $workDir, $projectId, $targetPath);

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
            $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
            if ($projectEntity->getUserId() != $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, trans('project.project_access_denied'));
            }

            // Call domain service to batch delete files
            $result = $this->taskFileDomainService->batchDeleteProjectFiles(
                $dataIsolation,
                $projectEntity->getWorkDir(),
                $projectId,
                $fileIds,
                $forceDelete
            );

            $this->logger->info(sprintf(
                'Successfully batch deleted files: Project ID: %s, File count: %d',
                $projectId,
                count($fileIds)
            ));

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
            $fileEntity = $this->taskFileDomainService->getUserFileEntity($dataIsolation, $fileId);
            $projectEntity = $this->projectDomainService->getProject($fileEntity->getProjectId(), $dataIsolation->getCurrentUserId());

            if ($fileEntity->getIsDirectory()) {
                // Directory rename: batch process all sub-files
                $renamedCount = $this->taskFileDomainService->renameDirectoryFiles(
                    $dataIsolation,
                    $fileEntity,
                    $projectEntity->getWorkDir(),
                    $targetName
                );
                // Get the updated entity after rename
                $newFileEntity = $this->taskFileDomainService->getById($fileId);
            } else {
                // Single file rename: use existing method
                $newFileEntity = $this->taskFileDomainService->renameProjectFile($dataIsolation, $fileEntity, $projectEntity->getWorkDir(), $targetName);
            }

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

    public function moveFile(RequestContext $requestContext, int $fileId, int $targetParentId, ?int $preFileId = null): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            // 1. Get file and project information
            $fileEntity = $this->taskFileDomainService->getUserFileEntity($dataIsolation, $fileId);
            $projectEntity = $this->projectDomainService->getProject($fileEntity->getProjectId(), $dataIsolation->getCurrentUserId());

            // 2. Handle target parent directory
            if (empty($targetParentId)) {
                $targetParentId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
                    projectId: $projectEntity->getId(),
                    workDir: $projectEntity->getWorkDir(),
                    userId: $dataIsolation->getCurrentUserId(),
                    organizationCode: $dataIsolation->getCurrentOrganizationCode(),
                );
            }

            // 3. Handle cross-directory move file path update (check BEFORE modifying parent_id)
            $originalParentId = $fileEntity->getParentId();
            if ($originalParentId !== $targetParentId) {
                $this->taskFileDomainService->moveProjectFile(
                    $dataIsolation,
                    $fileEntity,
                    $projectEntity->getWorkDir(),
                    $targetParentId
                );
            }

            // 4. Use enhanced sorting method to handle move (includes locking and rebalancing)
            $this->taskFileDomainService->handleFileSortOnMove(
                $fileEntity,
                $targetParentId,
                $preFileId
            );

            return [
                'file_id' => $fileId,
                'target_parent_id' => $targetParentId,
                'pre_file_id' => $preFileId,
            ];
        } catch (BusinessException $e) {
            $this->logger->warning(sprintf(
                'Business logic error in move file: %s, File ID: %s, Target Parent ID: %s, Error Code: %d',
                $e->getMessage(),
                $fileId,
                $targetParentId,
                $e->getCode()
            ));
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'System error in move project file: %s, File ID: %s, Target Parent ID: %s',
                $e->getMessage(),
                $fileId,
                $targetParentId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_MOVE_FAILED, trans('file.file_move_failed'));
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
    public function getFileUrls(RequestContext $requestContext, array $fileIds, string $downloadMode, array $options = []): array
    {
        try {
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            return $this->taskFileDomainService->getFileUrls(
                $dataIsolation,
                $fileIds,
                $downloadMode,
                $options
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
     * @return array File URLs
     */
    public function getFileUrlsByAccessToken(array $fileIds, string $accessToken, string $downloadMode): array
    {
        try {
            return $this->taskFileDomainService->getFileUrlsByAccessToken(
                $fileIds,
                $accessToken,
                $downloadMode
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
}
