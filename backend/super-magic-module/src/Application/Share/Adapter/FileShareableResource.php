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
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * File shareable resource adapter.
 */
class FileShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly FileCollectionDomainService $fileCollectionDomainService,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly TaskFileDomainService $taskFileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Get file content for sharing.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        try {
            // 获取文件集
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

            // 提取文件ID列表（转换为整数）
            $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);

            // 获取文件实体（只需要第一个文件来获取项目ID）
            $fileEntities = $this->taskFileRepository->getFilesWithParentsByIds($fileIds);
            if (empty($fileEntities)) {
                return [
                    'project_id' => '',
                    'project_name' => '',
                    'extended' => [],
                ];
            }

            // 从第一个文件获取项目ID
            $firstFile = $fileEntities[0];
            $projectId = $firstFile->getProjectId();

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

            // 返回和项目类型一样的数据结构
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
            $this->logger->error('Failed to get file content: ' . $e->getMessage());
            return [
                'project_id' => '',
                'project_name' => '',
                'extended' => [],
            ];
        }
    }

    /**
     * Get file name.
     */
    public function getResourceName(string $resourceId): string
    {
        return '';
    }

    /**
     * Check if file collection is shareable.
     *
     * 检查文件集是否可分享：
     * 1. 文件集必须存在且不为空
     * 2. 文件集中的所有文件必须属于指定组织
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        // 获取文件集
        $collectionId = (int) $resourceId;
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            $this->logger->warning('File collection not found or empty', ['collection_id' => $resourceId]);
            return false; // 文件集不存在或为空
        }

        // 检查文件集中的文件是否都属于该组织
        $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);
        $fileEntities = $this->taskFileRepository->getFilesWithParentsByIds($fileIds);

        if (empty($fileEntities)) {
            $this->logger->warning('No files found in collection', ['collection_id' => $resourceId]);
            return false;
        }

        foreach ($fileEntities as $fileEntity) {
            if ($fileEntity->getOrganizationCode() !== $organizationCode) {
                $this->logger->warning('File in collection does not belong to organization', [
                    'collection_id' => $resourceId,
                    'file_id' => $fileEntity->getFileId(),
                    'file_org' => $fileEntity->getOrganizationCode(),
                    'expected_org' => $organizationCode,
                ]);
                return false; // 文件集中有不属于该组织的文件
            }
        }

        return true;
    }

    /**
     * Check if user has permission to share the file collection.
     *
     * 权限策略：
     * 1. 文件集必须存在且不为空
     * 2. 文件集中的所有文件必须属于指定组织
     * 3. 用户必须是项目创建者或有分享权限的协作者（管理者/编辑者）
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        // 获取文件集
        $collectionId = (int) $resourceId;
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            $this->logger->warning('File collection not found or empty when checking permission', [
                'collection_id' => $resourceId,
            ]);
            return false;
        }

        // 获取文件集中的所有文件
        $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);
        $fileEntities = $this->taskFileRepository->getFilesWithParentsByIds($fileIds);

        if (empty($fileEntities)) {
            $this->logger->warning('No files found in collection when checking permission', [
                'collection_id' => $resourceId,
            ]);
            return false;
        }

        // 收集所有涉及的项目ID（去重）
        $projectIds = [];
        foreach ($fileEntities as $fileEntity) {
            $projectId = $fileEntity->getProjectId();
            if ($projectId <= 0) {
                $this->logger->warning('File in collection does not belong to any project', [
                    'collection_id' => $resourceId,
                    'file_id' => $fileEntity->getFileId(),
                ]);
                return false; // 文件必须属于某个项目
            }
            $projectIds[$projectId] = true; // 使用数组键去重
        }

        // 检查用户是否对所有涉及的项目都有分享权限（项目创建者或有分享权限的协作者）
        foreach (array_keys($projectIds) as $projectId) {
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if (! $projectEntity) {
                $this->logger->warning('Project not found when checking share permission', [
                    'collection_id' => $resourceId,
                    'project_id' => $projectId,
                ]);
                return false;
            }

            // 如果是项目创建者，继续检查下一个项目
            if ($projectEntity->getUserId() === $userId) {
                continue;
            }

            // 检查协作者权限：只允许管理者和编辑者分享
            $hasPermission = false;

            // 检查直接成员权限
            $projectMemberEntity = $this->projectMemberDomainService->getMemberByProjectAndUser($projectId, $userId);
            if ($projectMemberEntity && $projectMemberEntity->getRole()->hasSharePermission()) {
                $hasPermission = true;
            }

            // 如果没有直接权限，检查部门成员权限
            if (! $hasPermission) {
                $dataIsolation = DataIsolation::create($organizationCode, $userId);
                $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

                if (! empty($departmentIds)) {
                    $departmentMemberEntities = $this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectId, $departmentIds);

                    foreach ($departmentMemberEntities as $departmentMemberEntity) {
                        if ($departmentMemberEntity->getRole()->hasSharePermission()) {
                            $hasPermission = true;
                            break;
                        }
                    }
                }
            }

            if (! $hasPermission) {
                $this->logger->warning('User does not have share permission for project', [
                    'collection_id' => $resourceId,
                    'project_id' => $projectId,
                    'user_id' => $userId,
                    'project_creator_id' => $projectEntity->getUserId(),
                ]);
                return false;
            }
        }

        return true; // 用户对所有涉及项目都有分享权限
    }

    public function hasManageSharePermission(string $shareCreatorId, string $userId, string $resourceId, string $organizationCode): bool
    {
        // 只有分享创建者才有权限管理（取消）分享
        return $shareCreatorId === $userId;
    }

    /**
     * Extend file share list with additional info.
     *
     * 根据 share_project 字段决定如何计算 file_count：
     * - 如果 share_project=true：file_count 等于当前项目的文件数量
     * - 如果 share_project=false：file_count 等于文件集中的文件数量（动态生成，不能返回 file_ids.length）
     */
    public function getResourceExtendList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 按 share_project 分组处理
        $projectShareItems = []; // share_project=true 的项目分享项
        $fileShareItems = []; // share_project=false 的文件分享项

        foreach ($list as $index => $item) {
            // 确保 extend 字段存在
            if (! isset($list[$index]['extend']) || ! is_array($list[$index]['extend'])) {
                $list[$index]['extend'] = [];
            }

            $shareProject = isset($item['share_project']) ? (bool) $item['share_project'] : false;

            if ($shareProject) {
                // 项目分享：需要查询项目的文件数量
                $projectId = isset($item['project_id']) ? (int) $item['project_id'] : 0;
                if ($projectId > 0) {
                    $projectShareItems[$index] = [
                        'item' => $item,
                        'project_id' => $projectId,
                    ];
                } else {
                    // 如果没有 project_id，设置为 0
                    $list[$index]['extend']['file_count'] = 0;
                }
            } else {
                // 文件分享：需要查询文件集的文件数量
                $collectionId = isset($item['resource_id']) ? (int) $item['resource_id'] : 0;
                if ($collectionId > 0) {
                    $fileShareItems[$index] = [
                        'item' => $item,
                        'collection_id' => $collectionId,
                    ];
                } else {
                    // 如果没有 collection_id，设置为 0
                    $list[$index]['extend']['file_count'] = 0;
                }
            }
        }

        // 1. 批量查询项目分享的文件数量（share_project=true）
        // 依据：开启项目分享时，file_count应该反映整个项目的文件数量
        if (! empty($projectShareItems)) {
            $projectIds = array_unique(array_column($projectShareItems, 'project_id'));
            $projectFileCountMap = $this->taskFileRepository->countFilesByProjectIds($projectIds);

            // 为每个项目分享添加 file_count
            foreach ($projectShareItems as $index => $data) {
                $projectId = $data['project_id'];
                $fileCount = $projectFileCountMap[$projectId] ?? 0;
                $list[$index]['extend']['file_count'] = $fileCount;
            }
        }

        // 2. 批量查询文件分享的实际文件数量（share_project=false）
        // 依据：没有开启项目分享时，需要遍历file_ids，检查每个ID是否为文件夹
        // 如果是文件夹，递归计算其包含的文件数量
        if (! empty($fileShareItems)) {
            // 为每个文件分享计算实际文件数量
            foreach ($fileShareItems as $index => $data) {
                $collectionId = $data['collection_id'];
                $actualFileCount = $this->calculateFileCountFromCollection($collectionId);
                $list[$index]['extend']['file_count'] = $actualFileCount;
            }
        }

        // 确保所有项都有 extend.file_count 字段（兜底处理）
        foreach ($list as $index => $item) {
            if (! isset($list[$index]['extend']['file_count'])) {
                $list[$index]['extend']['file_count'] = 0;
            }
        }

        return $list;
    }

    /**
     * Create resource DTO.
     */
    public function createResource(string $resourceId, string $userId, string $organizationCode): ShareableResourceDTO
    {
        return new ShareableResourceDTO();
    }

    /**
     * 获取用于详情接口显示的资源名称.
     * 对于文件集类型，返回项目名称.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return string 项目名称
     */
    public function getResourceNameForDetail(ResourceShareEntity $shareEntity): string
    {
        $projectId = $shareEntity->getProjectId();

        if ($projectId === null || (int) $projectId <= 0) {
            return '';
        }

        $projectNameMap = $this->projectDomainService->getProjectNamesBatch([(int) $projectId]);
        return $projectNameMap[(int) $projectId] ?? '';
    }

    /**
     * 根据文件集ID计算实际文件数量（考虑文件夹递归）.
     *
     * 依据：当没有开启项目分享时，需要遍历file_ids中的每个ID，
     * 检查是否为文件夹，如果是文件夹则递归计算其包含的文件数量。
     *
     * 修复：先展开所有文件夹和文件，合并后去重，避免重复计算。
     * 例如：如果file_ids包含【文件夹A，文件a】，且文件a是文件夹A的子文件，
     * 则文件a会被去重，只计算一次。
     *
     * @param int $collectionId 文件集ID
     * @return int 实际文件数量
     */
    private function calculateFileCountFromCollection(int $collectionId): int
    {
        // 1. 获取文件集中的原始file_ids
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($fileCollectionItems)) {
            return 0;
        }

        // 2. 提取文件ID列表（这是用户创建分享时传入的原始ID）
        $originalIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);

        // 3. 批量获取文件实体（只获取原始file_ids对应的实体）
        $fileEntities = $this->taskFileRepository->getFilesByIds($originalIds);
        if (empty($fileEntities)) {
            return 0;
        }

        $projectId = $fileEntities[0]->getProjectId(); // 获取项目ID用于递归查询
        if ($projectId <= 0) {
            return 0;
        }

        // 4. 【中间过程】展开所有文件ID：分离文件夹和文件
        $allFileIds = []; // 存储所有文件ID（临时中间过程）
        $directoryIds = []; // 存储文件夹ID列表（用于批量展开）

        foreach ($fileEntities as $entity) {
            if ($entity->getIsDirectory()) {
                // 是文件夹，收集起来批量展开
                $directoryIds[] = $entity->getFileId();
            } else {
                // 是文件，直接加入列表
                $allFileIds[] = $entity->getFileId();
            }
        }

        // 5. 批量展开所有文件夹的子文件（性能优化：一次查询多个文件夹）
        if (! empty($directoryIds)) {
            $childFileIds = $this->taskFileDomainService->getAllChildrenFileIdsByDirectoryIds(
                $directoryIds,
                $projectId
            );
            // 合并文件夹展开后的子文件ID
            $allFileIds = array_merge($allFileIds, $childFileIds);
        }

        // 6. 去重（关键步骤：避免重复计算）
        $uniqueFileIds = array_unique($allFileIds);

        // 7. 返回去重后的文件数量
        return count($uniqueFileIds);
    }
}
