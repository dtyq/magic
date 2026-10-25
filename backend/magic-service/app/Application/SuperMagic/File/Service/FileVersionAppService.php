<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Domain\SuperMagic\File\Entity\ValueObject\FileChangeOrigin;
use App\Domain\SuperMagic\File\Event\FileContentSavedEvent;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\File\Service\TaskFileVersionDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\File\DTO\Request\CreateFileVersionRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\GetFileVersionsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\RollbackFileToVersionRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\CreateFileVersionResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\GetFileVersionsResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\GetLatestFileVersionResponseDTO;
use App\Interfaces\SuperMagic\File\DTO\Response\RollbackFileToVersionResponseDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Log\LoggerInterface;

class FileVersionAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskFileVersionDomainService $taskFileVersionDomainService,
        private readonly EventDispatcherInterface $eventDispatcher,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 创建文件版本.
     *
     * @param CreateFileVersionRequestDTO $requestDTO 请求DTO
     * @return CreateFileVersionResponseDTO 创建结果
     */
    public function createFileVersion(
        CreateFileVersionRequestDTO $requestDTO
    ): CreateFileVersionResponseDTO {
        // 获取用户授权信息
        $fileKey = $requestDTO->getFileKey();
        $editType = $requestDTO->getEditType();

        $this->logger->info('Creating file version', [
            'file_key' => $fileKey,
            'edit_type' => $editType,
        ]);

        // 验证文件是否存在
        $fileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
        if (! $fileEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        // 验证文件是否为目录
        if ($fileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_version_directory');
        }

        if (! $this->taskFileVersionDomainService->canCreateVersion($fileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_version_file');
        }

        // 项目文件走项目解析（project_id > 0）；用户空间文件不挂在项目下
        // （project_id = 0），组织编码直接取文件自身，版本副本落在该文件
        // 自己的存储前缀下。
        if ($fileEntity->getProjectId() > 0) {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($fileEntity->getProjectId());
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
            }
            $organizationCode = $projectEntity->getUserOrganizationCode();
        } else {
            $organizationCode = $fileEntity->getOrganizationCode();
        }

        // 调用Domain Service创建版本
        $versionEntity = $this->taskFileVersionDomainService->createFileVersion($organizationCode, $fileEntity, $editType);

        if (! $versionEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.version_create_failed');
        }

        $this->logger->info('File version created successfully', [
            'file_key' => $fileKey,
            'file_id' => $fileEntity->getFileId(),
            'version_id' => $versionEntity->getId(),
            'version' => $versionEntity->getVersion(),
            'edit_type' => $editType,
        ]);

        // 返回结果
        return CreateFileVersionResponseDTO::create($versionEntity->getVersion());
    }

    /**
     * 分页获取文件版本列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param GetFileVersionsRequestDTO $requestDTO 请求DTO
     * @return GetFileVersionsResponseDTO 查询结果
     */
    public function getFileVersions(
        RequestContext $requestContext,
        GetFileVersionsRequestDTO $requestDTO
    ): GetFileVersionsResponseDTO {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $fileId = $requestDTO->getFileId();

        $this->logger->info('Getting file versions with pagination', [
            'file_id' => $fileId,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        // 验证文件是否存在
        $fileEntity = $this->taskFileDomainService->getById($fileId);
        if (! $fileEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        // 验证文件权限 - 确保文件属于当前组织
        /*if ($fileEntity->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.access_denied');
        }*/

        // 验证项目权限
        if ($fileEntity->getProjectId() > 0) {
            $this->getAccessibleProject(
                $fileEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
        }

        // 调用Domain Service获取分页数据
        $result = $this->taskFileVersionDomainService->getFileVersionsWithPage(
            $fileId,
            $requestDTO->getPage(),
            $requestDTO->getPageSize()
        );

        $this->logger->info('File versions retrieved successfully', [
            'file_id' => $fileId,
            'total' => $result['total'],
            'current_page_count' => count($result['list']),
        ]);

        // 返回结果
        return GetFileVersionsResponseDTO::fromData($result['list'], $result['total'], $requestDTO->getPage());
    }

    /**
     * 获取文件最新版本号.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $fileId 文件ID
     * @return GetLatestFileVersionResponseDTO 查询结果
     */
    public function getLatestFileVersion(
        RequestContext $requestContext,
        int $fileId
    ): GetLatestFileVersionResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        $this->logger->info('Getting latest file version', [
            'file_id' => $fileId,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        $fileEntity = $this->taskFileDomainService->getById($fileId);
        if (! $fileEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        if ($fileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_version_directory');
        }

        if ($fileEntity->getProjectId() > 0) {
            $this->getAccessibleProject(
                $fileEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
        }

        return GetLatestFileVersionResponseDTO::create($fileEntity->getFileId(), $fileEntity->getLatestVersion());
    }

    /**
     * 文件回滚到指定版本.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param RollbackFileToVersionRequestDTO $requestDTO 请求DTO
     * @return RollbackFileToVersionResponseDTO 回滚结果
     */
    public function rollbackFileToVersion(
        RequestContext $requestContext,
        RollbackFileToVersionRequestDTO $requestDTO
    ): RollbackFileToVersionResponseDTO {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $fileId = $requestDTO->getFileId();
        $targetVersion = $requestDTO->getVersion();

        $this->logger->info('Rolling back file to version', [
            'file_id' => $fileId,
            'target_version' => $targetVersion,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        // 验证文件是否存在
        $fileEntity = $this->taskFileDomainService->getById($fileId);
        if (! $fileEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        // 验证文件是否为目录
        if ($fileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_rollback_directory');
        }

        if (! $this->taskFileVersionDomainService->canCreateVersion($fileEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_version_file');
        }

        // 项目文件走项目权限校验；用户空间文件（project_id = 0）不挂在
        // 项目下，组织编码取文件自身。
        if ($fileEntity->getProjectId() > 0) {
            $projectEntity = $this->getAccessibleProject(
                $fileEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
            $organizationCode = $projectEntity->getUserOrganizationCode();
        } else {
            $organizationCode = $fileEntity->getOrganizationCode();
        }

        $newVersionEntity = $this->taskFileVersionDomainService->rollbackFileToVersion(
            $organizationCode,
            $fileEntity,
            $targetVersion
        );

        if (! $newVersionEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.rollback_failed');
        }

        // Refresh file metadata (file_size + updated_at) from cloud storage
        $this->taskFileDomainService->refreshFileMetadataFromCloudStorage(
            $fileEntity,
            $organizationCode
        );

        $this->logger->info('File rollback completed successfully', [
            'file_id' => $fileId,
            'target_version' => $targetVersion,
            'new_version_id' => $newVersionEntity->getId(),
            'new_version' => $newVersionEntity->getVersion(),
        ]);

        // Dispatch file content saved event so clients receive a WebSocket notification
        $this->eventDispatcher->dispatch(new FileContentSavedEvent(
            $fileEntity,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode(),
            FileChangeOrigin::VERSION_ROLLBACK
        ));

        return RollbackFileToVersionResponseDTO::createEmpty();
    }
}
