<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileVersionDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\CreateFileVersionResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\GetFileVersionsResponseDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class FileVersionAppService extends AbstractAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly TaskFileVersionDomainService $taskFileVersionDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 创建文件版本.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param CreateFileVersionRequestDTO $requestDTO 请求DTO
     * @return CreateFileVersionResponseDTO 创建结果
     */
    public function createFileVersion(
        RequestContext $requestContext,
        CreateFileVersionRequestDTO $requestDTO
    ): CreateFileVersionResponseDTO {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $fileKey = $requestDTO->getFileKey();

        $this->logger->info('Creating file version', [
            'file_key' => $fileKey,
            'user_id' => $dataIsolation->getCurrentUserId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        // 验证文件是否存在
        $fileEntity = $this->taskFileDomainService->getByFileKey($fileKey);
        if (! $fileEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_NOT_FOUND, 'file.file_not_found');
        }

        // 验证文件权限 - 确保文件属于当前组织
        if ($fileEntity->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.access_denied');
        }

        // 验证文件是否为目录
        if ($fileEntity->getIsDirectory()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.cannot_version_directory');
        }

        // 验证项目权限
        if ($fileEntity->getProjectId() > 0) {
            $this->getAccessibleProject(
                $fileEntity->getProjectId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );
        }

        // 调用Domain Service创建版本
        $versionEntity = $this->taskFileVersionDomainService->createFileVersion($fileEntity);

        if (! $versionEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_SAVE_FAILED, 'file.version_create_failed');
        }

        $this->logger->info('File version created successfully', [
            'file_key' => $fileKey,
            'file_id' => $fileEntity->getFileId(),
            'version_id' => $versionEntity->getId(),
            'version' => $versionEntity->getVersion(),
        ]);

        // 返回结果
        return CreateFileVersionResponseDTO::fromEntity($versionEntity);
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
        if ($fileEntity->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_PERMISSION_DENIED, 'file.access_denied');
        }

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
}
