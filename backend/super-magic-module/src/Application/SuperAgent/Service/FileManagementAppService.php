<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\File\Service\FileAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteDirectoryRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TopicUploadTokenRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

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
                    ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
                }
            } else {
                // 情况2：无项目ID，使用雪花ID生成临时项目ID
                $tempProjectId = IdGenerator::getSnowId();
                $workDir = WorkDirectoryUtil::getWorkDir($userId, $tempProjectId);
            }

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::Private->value;

            return $this->fileAppService->getStsTemporaryCredential(
                $userAuthorization,
                $storageType,
                $workDir,
                $expires
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to get project upload token: %s, Project ID: %s',
                $e->getMessage(),
                $requestDTO->getProjectId()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
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
                ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.not_found');
            }
            $workDir = WorkDirectoryUtil::getTopicUploadDir($userId, $topicEntity->getProjectId(), $topicEntity->getId());

            // 获取STS Token
            $userAuthorization = new MagicUserAuthorization();
            $userAuthorization->setOrganizationCode($organizationCode);
            $storageType = StorageBucketType::Private->value;

            return $this->fileAppService->getStsTemporaryCredential(
                $userAuthorization,
                $storageType,
                $workDir,
                $expires
            );
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to get topic upload token: %s, Topic ID: %s',
                $e->getMessage(),
                $requestDTO->getTopicId()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
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
        try {
            // 获取用户授权信息
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            $projectId = $requestDTO->getProjectId();

            if (empty($requestDTO->getFileKey())) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_key_required');
            }

            if (empty($requestDTO->getFileName())) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_name_required');
            }

            if ($requestDTO->getFileSize() <= 0) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file_size_required');
            }

            // 校验项目归属权限 - 确保用户只能保存到自己的项目
            if (! empty($projectId)) {
                $projectEntity = $this->projectDomainService->getProject((int) $requestDTO->getProjectId(), $dataIsolation->getCurrentUserId());
                if ($projectEntity->getUserId() != $dataIsolation->getCurrentUserId()) {
                    ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
                }
            }

            // 创建 TaskFileEntity 实体
            $taskFileEntity = $requestDTO->toEntity();

            // 调用领域服务保存文件
            $taskFileEntity = $this->taskFileDomainService->saveProjectFile(
                $dataIsolation,
                $taskFileEntity
            );

            // 返回保存结果
            $result = [
                'file_id' => (string) $taskFileEntity->getFileId(),
                'file_key' => $taskFileEntity->getFileKey(),
                'file_name' => $taskFileEntity->getFileName(),
                'file_size' => $taskFileEntity->getFileSize(),
                'file_type' => $taskFileEntity->getFileType(),
                'source' => $taskFileEntity->getSource()->value,
                'source_name' => $taskFileEntity->getSource()->getName(),
                'is_directory' => $taskFileEntity->getIsDirectory(),
                'sort' => $taskFileEntity->getSort(),
                'parent_id' => $taskFileEntity->getParentId(),
                'created_at' => $taskFileEntity->getCreatedAt(),
                'relative_file_path' => '',
            ];

            // 如果有项目ID，添加相对路径
            if (! empty($projectId)) {
                $result['relative_file_path'] = WorkDirectoryUtil::getRelativeFilePath(
                    $taskFileEntity->getFileKey(),
                    $projectEntity->getWorkDir()
                );
            }

            return $result;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to save project file: %s, Project ID: %s, File Key: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileKey()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
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
        try {
            // 获取用户授权信息
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            $projectId = (int) $requestDTO->getProjectId();
            $parentId = (int) $requestDTO->getParentId();

            // 校验项目归属权限 - 确保用户只能在自己的项目中创建文件
            $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
            if ($projectEntity->getUserId() != $dataIsolation->getCurrentUserId()) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }

            // 调用领域服务创建文件或文件夹
            $taskFileEntity = $this->taskFileDomainService->createProjectFile(
                $dataIsolation,
                $projectEntity,
                $parentId,
                $requestDTO->getFileName(),
                $requestDTO->getIsDirectory()
            );

            // 返回创建结果
            return [
                'file_id' => (string) $taskFileEntity->getFileId(),
                'file_key' => $taskFileEntity->getFileKey(),
                'is_directory' => $taskFileEntity->getIsDirectory(),
            ];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to create file: %s, Project ID: %s, File Name: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getFileName()
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
        }
    }

    public function deleteFile(RequestContext $requestContext, int $fileId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $fileEntity = $this->taskFileDomainService->getUserFileEntity($dataIsolation, $fileId);
            $this->taskFileDomainService->deleteProjectFiles($dataIsolation, $fileEntity);
            return ['file_id' => $fileId];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to delete project file: %s, File ID: %s',
                $e->getMessage(),
                $fileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, 'file.delete_failed');
        }
    }

    public function deleteDirectory(RequestContext $requestContext, DeleteDirectoryRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $userId = $dataIsolation->getCurrentUserId();
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        try {
            $projectId = (int) $requestDTO->getProjectId();
            $path = $requestDTO->getPath();

            // 1. 验证项目是否属于当前用户
            $projectEntity = $this->projectDomainService->getProject($projectId, $userId);

            // 2. 获取工作目录并拼接完整路径
            $workDir = $projectEntity->getWorkDir();
            if (empty($workDir)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::WORK_DIR_NOT_FOUND, 'project.work_dir.not_found');
            }

            // 3. 构建目标删除路径
            $fullPrefix = WorkDirectoryUtil::getFullPrefix($organizationCode);
            $targetPath = $fullPrefix . trim($workDir, '/') . '/' . trim($path, '/');

            // 4. 调用领域服务执行批量删除
            $deletedCount = $this->taskFileDomainService->deleteDirectoryFiles($dataIsolation, $workDir, $projectId, $targetPath);

            $this->logger->info(sprintf(
                'Successfully deleted directory: Project ID: %s, Path: %s, Deleted files: %d',
                $projectId,
                $path,
                $deletedCount
            ));

            return [
                'project_id' => $projectId,
                'path' => $path,
                'deleted_count' => $deletedCount,
            ];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to delete directory: %s, Project ID: %s, Path: %s',
                $e->getMessage(),
                $requestDTO->getProjectId(),
                $requestDTO->getPath()
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_DELETE_FAILED, 'file.directory_delete_failed');
        }
    }

    public function renameFile(RequestContext $requestContext, int $fileId, string $targetName): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $fileEntity = $this->taskFileDomainService->getUserFileEntity($dataIsolation, $fileId);
            $projectEntity = $this->projectDomainService->getProject($fileEntity->getProjectId(), $dataIsolation->getCurrentUserId());
            $this->taskFileDomainService->renameProjectFile($dataIsolation, $fileEntity, $projectEntity->getWorkDir(), $targetName);
            return ['file_id' => $fileId];
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to rename project file: %s, File ID: %s',
                $e->getMessage(),
                $fileId
            ));
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_RENAME_FAILED, 'file.file_rename_failed');
        }
    }
}
