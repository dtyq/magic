<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Adapter;

use App\Application\Chat\Service\MagicUserContactAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Project shareable resource adapter.
 */
class ProjectShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly ProjectAppService $projectAppService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private readonly MagicUserContactAppService $magicUserContactAppService,
        private readonly TaskFileDomainService $taskFileDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Get project content for sharing.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        try {
            // Get project details
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }

            $userInfo = $this->magicUserContactAppService->getByUserId($projectEntity->getUserId());
            if (! empty($userInfo)) {
                $creator = $userInfo->getNickname();
            } else {
                $creator = '';
            }

            // Get project basic info
            return [
                'project_id' => (string) $projectEntity->getId(),
                'project_name' => $projectEntity->getProjectName(),
                'extended' => [
                    'description' => $projectEntity->getProjectDescription(),
                    'creator' => $creator,
                    'fork_num' => $this->projectAppService->getProjectForkCount($projectEntity->getId()),
                ],
            ];
        } catch (Exception $e) {
            $this->logger->error('Failed to get project content: ' . $e->getMessage());
            return [
                'project_info' => null,
                'attachments' => ['total' => 0, 'list' => []],
                'error' => 'Project not found or access denied',
            ];
        }
    }

    /**
     * Get project name.
     */
    public function getResourceName(string $resourceId): string
    {
        try {
            // We need to get project without userId check for share scenarios
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }
            return $projectEntity->getProjectName() ?? 'Unknown Project';
        } catch (Exception $e) {
            $this->logger->warning('Failed to get project name: ' . $e->getMessage());
            return 'Unknown Project';
        }
    }

    /**
     * Check if project is shareable.
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        try {
            // Check if project exists
            $projectEntity = $this->projectAppService->getProjectNotUserId((int) $resourceId);
            if (! $projectEntity) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
            }
            return true;
        } catch (Exception $e) {
            $this->logger->warning('Project shareability check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if user has permission to share the project.
     * 权限策略：用户必须是项目创建者或有分享权限的协作者（管理者/编辑者）.
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        try {
            $projectId = (int) $resourceId;

            // 获取项目实体
            $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
            if (! $projectEntity) {
                $this->logger->warning('Project not found when checking share permission', [
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
                            'project_id' => $projectId,
                            'user_id' => $userId,
                            'role' => $departmentMemberEntity->getRole()->getValue(),
                            'department_id' => $departmentMemberEntity->getTargetId(),
                        ]);
                        return true;
                    }
                }
            }

            $this->logger->warning('User does not have share permission for project', [
                'project_id' => $projectId,
                'user_id' => $userId,
                'project_creator_id' => $projectEntity->getUserId(),
            ]);

            return false;
        } catch (Exception $e) {
            $this->logger->warning('Project share permission check failed: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if user has permission to manage (cancel) the project share.
     */
    public function hasManageSharePermission(string $shareCreatorId, string $userId, string $resourceId, string $organizationCode): bool
    {
        // 只有分享创建者才有权限管理（取消）分享
        return $shareCreatorId === $userId;
    }

    /**
     * Extend project share list with additional info.
     */
    public function getResourceExtendList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        $projectShareItems = [];

        // 确保每个项都有 extend 字段，并收集项目ID
        foreach ($list as $index => $item) {
            if (! isset($list[$index]['extend']) || ! is_array($list[$index]['extend'])) {
                $list[$index]['extend'] = [];
            }

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
        }

        // 批量查询项目分享的文件数量
        if (! empty($projectShareItems)) {
            $projectIds = array_unique(array_column($projectShareItems, 'project_id'));

            // 通过 Domain Service 获取文件数量，符合DDD架构
            $projectFileCountMap = $this->taskFileDomainService->countFilesByProjectIds($projectIds);

            // 为每个项目分享添加 file_count
            foreach ($projectShareItems as $index => $data) {
                $projectId = $data['project_id'];
                $fileCount = $projectFileCountMap[$projectId] ?? 0;
                $list[$index]['extend']['file_count'] = $fileCount;
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
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return string 资源名称
     */
    public function getResourceNameForDetail(ResourceShareEntity $shareEntity): string
    {
        return $shareEntity->getResourceName();
    }
}
