<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Adapter;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Single file shareable resource adapter.
 * 单文件分享适配器，用于 File 资源类型（resource_type = 15）
 * 注意：单文件也使用文件集来存储，resource_id 就是文件集ID（只有一个文件）.
 */
class SingleFileShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly FileCollectionDomainService $fileCollectionDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function createResource(string $resourceId, string $userId, string $organizationCode): ShareableResourceDTO
    {
        // 先查询是否存在
        return new ShareableResourceDTO();
    }

    /**
     * 检查文件是否可分享.
     * resource_id 是文件集ID，通过文件集查询文件.
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        // 获取文件集（单文件也使用文件集存储）
        $collectionId = (int) $resourceId;
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            $this->logger->warning('File collection not found or empty', ['collection_id' => $resourceId]);
            return false; // 文件集不存在或为空
        }

        // 单文件应该只有一个文件项
        $fileId = (int) $fileCollectionItems[0]->getFileId();
        $fileEntity = $this->taskFileRepository->getById($fileId);

        if (! $fileEntity) {
            $this->logger->warning('File not found in collection', ['collection_id' => $resourceId, 'file_id' => $fileId]);
            return false;
        }

        // 检查文件是否属于指定组织
        return $fileEntity->getOrganizationCode() === $organizationCode;
    }

    /**
     * 检查用户是否有权限分享该文件.
     * resource_id 是文件集ID，通过文件集查询文件.
     *
     * 权限策略：
     * 1. 文件集必须存在且包含文件
     * 2. 文件必须存在且属于指定组织
     * 3. 文件必须属于某个项目
     * 4. 用户必须是项目创建者或有分享权限的协作者（管理者/编辑者）
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        // 获取文件集（单文件也使用文件集存储）
        $collectionId = (int) $resourceId;
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            $this->logger->warning('File collection not found or empty when checking permission', [
                'collection_id' => $resourceId,
            ]);
            return false;
        }

        // 单文件应该只有一个文件项
        $fileId = (int) $fileCollectionItems[0]->getFileId();
        $fileEntity = $this->taskFileRepository->getById($fileId);

        if (! $fileEntity) {
            $this->logger->warning('File not found when checking share permission', [
                'collection_id' => $resourceId,
                'file_id' => $fileId,
            ]);
            return false;
        }

        // 检查文件是否属于指定组织
        if ($fileEntity->getOrganizationCode() !== $organizationCode) {
            $this->logger->warning('File does not belong to organization', [
                'collection_id' => $resourceId,
                'file_id' => $fileId,
                'file_org' => $fileEntity->getOrganizationCode(),
                'user_org' => $organizationCode,
            ]);
            return false;
        }

        // 检查文件是否属于某个项目
        $projectId = $fileEntity->getProjectId();
        if ($projectId <= 0) {
            $this->logger->warning('File does not belong to any project', [
                'collection_id' => $resourceId,
                'file_id' => $fileId,
            ]);
            return false;
        }

        // 检查用户是否有分享权限（项目创建者或有分享权限的协作者）
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $projectEntity) {
            $this->logger->warning('Project not found when checking share permission', [
                'collection_id' => $resourceId,
                'project_id' => $projectId,
            ]);
            return false;
        }

        // 如果是项目创建者，直接允许
        if ($projectEntity->getUserId() === $userId) {
            return true;
        }

        // 检查协作者权限：只允许管理者和编辑者分享
        $projectMemberEntity = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $userId);

        if ($projectMemberEntity && $projectMemberEntity->getRole()->hasSharePermission()) {
            $this->logger->info('User has share permission as project collaborator', [
                'collection_id' => $resourceId,
                'file_id' => $fileId,
                'project_id' => $projectId,
                'user_id' => $userId,
                'role' => $projectMemberEntity->getRole()->getValue(),
            ]);
            return true;
        }

        // 检查部门成员权限
        $dataIsolation = DataIsolation::create($organizationCode, $userId);
        $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

        if (! empty($departmentIds)) {
            $departmentMemberEntities = $this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

            foreach ($departmentMemberEntities as $departmentMemberEntity) {
                if ($departmentMemberEntity->getRole()->hasSharePermission()) {
                    $this->logger->info('User has share permission as department member', [
                        'collection_id' => $resourceId,
                        'file_id' => $fileId,
                        'project_id' => $projectId,
                        'user_id' => $userId,
                        'role' => $departmentMemberEntity->getRole()->getValue(),
                        'department_id' => $departmentMemberEntity->getTargetId(),
                    ]);
                    return true;
                }
            }
        }

        $this->logger->warning('User does not have share permission', [
            'collection_id' => $resourceId,
            'file_id' => $fileId,
            'project_id' => $projectId,
            'user_id' => $userId,
            'project_creator_id' => $projectEntity->getUserId(),
        ]);

        return false;
    }

    /**
     * 检查用户是否有权限管理分享.
     */
    public function hasManageSharePermission(string $shareCreatorId, string $userId, string $resourceId, string $organizationCode): bool
    {
        // 只有分享创建者才有权限管理（取消）分享
        return $shareCreatorId === $userId;
    }

    /**
     * 获取文件内容（用于分享内容展示）.
     * 参考文件集的返回格式，返回包含project_id和project_name的数据结构.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        try {
            // 获取文件集（单文件也使用文件集存储）
            $collectionId = (int) $resourceId;
            $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

            if (empty($fileCollectionItems)) {
                // 如果文件集为空，返回空结构
                return [
                    'project_id' => '',
                    'project_name' => '',
                    'extended' => [],
                ];
            }

            // 单文件应该只有一个文件项
            $fileId = (int) $fileCollectionItems[0]->getFileId();
            $fileEntity = $this->taskFileRepository->getById($fileId);

            if (! $fileEntity) {
                return [
                    'project_id' => '',
                    'project_name' => '',
                    'extended' => [],
                ];
            }

            // 从文件获取项目ID
            $projectId = $fileEntity->getProjectId();

            if ($projectId === 0) {
                return [
                    'project_id' => '',
                    'project_name' => '',
                    'extended' => [],
                ];
            }

            // 获取项目详情
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }

            // 获取创建者信息
            $userInfo = $this->magicUserDomainService->getByUserId($projectEntity->getUserId());
            $creator = ! empty($userInfo) ? $userInfo->getNickname() : '';

            // 返回和文件集类型一样的数据结构
            return [
                'project_id' => (string) $projectEntity->getId(),
                'project_name' => $projectEntity->getProjectName(),
                'extended' => [
                    'description' => $projectEntity->getProjectDescription(),
                    'creator' => $creator,
                    'fork_num' => $this->projectDomainService->getProjectForkCount($projectEntity->getId()),
                ],
            ];
        } catch (Exception $e) {
            $this->logger->error('Failed to get single file content: ' . $e->getMessage());
            return [
                'project_id' => '',
                'project_name' => '',
                'extended' => [],
            ];
        }
    }

    /**
     * 获取文件名.
     * resource_id 是文件集ID，通过文件集查询文件.
     */
    public function getResourceName(string $resourceId): string
    {
        // 获取文件集（单文件也使用文件集存储）
        $collectionId = (int) $resourceId;
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            return '';
        }

        // 单文件应该只有一个文件项
        $fileId = (int) $fileCollectionItems[0]->getFileId();
        $fileEntity = $this->taskFileRepository->getById($fileId);

        if (! $fileEntity) {
            return '';
        }

        return $fileEntity->getFileName() ?: '未命名文件';
    }

    /**
     * 扩展资源列表信息.
     */
    public function getResourceExtendList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 为每个列表项添加空的extend信息
        return array_map(function ($item) {
            $item['extend'] = [];
            return $item;
        }, $list);
    }

    /**
     * 获取用于详情接口显示的资源名称.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return string 文件名
     */
    public function getResourceNameForDetail(ResourceShareEntity $shareEntity): string
    {
        // File 类型：resource_id 就是文件集ID，可以直接使用
        return $this->getResourceName($shareEntity->getResourceId());
    }
}
