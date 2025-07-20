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
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\FileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class FileManagementAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly FileAppService $fileAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
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
            if (!empty($projectId)) {
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
                'relative_file_path' => ''
            ];

            // 如果有项目ID，添加相对路径
            if (!empty($projectId)) {
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

    public function deleteFile(RequestContext $requestContext, int $fileId): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        try {
            $this->taskFileDomainService->deleteProjectFiles($dataIsolation, $fileId);
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

    /**
     * 获取项目文件列表（新增方法）
     */
    public function getProjectFileList(RequestContext $requestContext, int $projectId): array
    {
        try {
            // 1. 获取用户授权和数据隔离
            $userAuthorization = $requestContext->getUserAuthorization();
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            
            // 2. 调用项目领域服务获取项目实体
            $projectEntity = $this->projectDomainService->getProject($projectId, $dataIsolation->getCurrentUserId());
            
            // 3. 调用文件领域服务执行同步逻辑
            $syncResult = $this->fileDomainService->syncProjectFiles(
                $dataIsolation,
                $projectEntity
            );
            
            // 4. 组装返回数据
            return $this->assembleResponseData($syncResult, $projectEntity->getWorkDir());
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Failed to get project file list: %s, Project ID: %s',
                $e->getMessage(),
                $projectId
            ));
            ExceptionBuilder::throw(GenericErrorCode::SystemError, $e->getMessage());
        }
    }

    /**
     * 组装返回数据
     */
    private function assembleResponseData(array $syncResult, string $workDir): array
    {
        $list = [];
        
        foreach ($syncResult['files'] as $fileData) {
            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) ($fileData['file_id'] ?? crc32($fileData['file_key']));
            $dto->fileName = $fileData['file_name'];
            $dto->fileExtension = $fileData['file_extension'];
            $dto->fileKey = $fileData['file_key'];
            $dto->fileSize = $fileData['file_size'];
            $dto->fileUrl = $fileData['file_url'] ?? '';
            $dto->relativeFilePath = WorkDirectoryUtil::getRelativeFilePath($fileData['file_key'], $workDir);
            $dto->syncStatus = $fileData['sync_status'] ?? 'synced';
            
            $list[] = $dto->toArray();
        }
        
        // 构建文件树（如果FileTreeUtil存在的话）
        $tree = [];
        if (class_exists(FileTreeUtil::class)) {
            $tree = FileTreeUtil::assembleFilesTree($workDir, $list);
        }
        
        return [
            'list' => $list,
            'tree' => $tree,
            'total' => count($list),
            'sync_stats' => $syncResult['stats'],
            'cache_time' => date('Y-m-d H:i:s'),
        ];
    }
}
