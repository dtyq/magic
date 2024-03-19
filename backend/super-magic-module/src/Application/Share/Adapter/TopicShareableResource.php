<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Adapter;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Application\Share\Factory\Facade\ResourceFactoryInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class TopicShareableResource implements ResourceFactoryInterface
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly WorkspaceAppService $workspaceAppService,
        private readonly TopicDomainService $topicDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
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
     * Check if topic is shareable.
     *
     * 检查话题是否可分享：
     * 1. 话题必须存在且未被删除
     * 2. 话题必须属于指定组织
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool
    {
        // 获取话题实体
        $topicEntity = $this->topicDomainService->getTopicById((int) $resourceId);
        if (! $topicEntity) {
            $this->logger->warning('Topic not found when checking shareability', [
                'topic_id' => $resourceId,
                'organization_code' => $organizationCode,
                'note' => 'TopicRepository已尝试按id和chat_topic_id查询，均未找到',
            ]);
            return false;
        }

        // 检查话题是否已被删除
        if ($topicEntity->getDeletedAt() !== null) {
            $this->logger->warning('Topic has been deleted', [
                'topic_id' => $resourceId,
                'topic_db_id' => $topicEntity->getId(),
                'chat_topic_id' => $topicEntity->getChatTopicId(),
                'deleted_at' => $topicEntity->getDeletedAt(),
                'organization_code' => $organizationCode,
            ]);
            return false;
        }

        // 检查话题是否属于指定组织
        if ($topicEntity->getUserOrganizationCode() !== $organizationCode) {
            $this->logger->warning('Topic does not belong to organization', [
                'topic_id' => $resourceId,
                'topic_db_id' => $topicEntity->getId(),
                'chat_topic_id' => $topicEntity->getChatTopicId(),
                'topic_org' => $topicEntity->getUserOrganizationCode(),
                'expected_org' => $organizationCode,
            ]);
            return false;
        }

        return true;
    }

    /**
     * Check if user has permission to share the topic.
     *
     * 权限策略：
     * 1. 话题必须存在且属于指定组织
     * 2. 话题必须属于某个项目
     * 3. 用户必须是项目创建者或有分享权限的协作者（管理者/编辑者）
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool
    {
        // 获取话题实体
        $topicEntity = $this->topicDomainService->getTopicById((int) $resourceId);
        if (! $topicEntity) {
            $this->logger->warning('Topic not found when checking share permission', [
                'topic_id' => $resourceId,
                'user_id' => $userId,
                'organization_code' => $organizationCode,
                'note' => 'TopicRepository已尝试按id和chat_topic_id查询，均未找到',
            ]);
            return false;
        }

        // 检查话题是否已被删除
        if ($topicEntity->getDeletedAt() !== null) {
            $this->logger->warning('Cannot share deleted topic', ['topic_id' => $resourceId]);
            return false;
        }

        // 检查话题是否属于指定组织
        if ($topicEntity->getUserOrganizationCode() !== $organizationCode) {
            $this->logger->warning('Topic does not belong to organization', [
                'topic_id' => $resourceId,
                'topic_org' => $topicEntity->getUserOrganizationCode(),
                'user_org' => $organizationCode,
            ]);
            return false;
        }

        // 检查话题是否属于某个项目
        $projectId = $topicEntity->getProjectId();
        if ($projectId <= 0) {
            $this->logger->warning('Topic does not belong to any project', ['topic_id' => $resourceId]);
            return false;
        }

        // 检查用户是否有分享权限（项目创建者或有分享权限的协作者）
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $projectEntity) {
            $this->logger->warning('Project not found when checking share permission', [
                'topic_id' => $resourceId,
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
                'topic_id' => $resourceId,
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
                        'topic_id' => $resourceId,
                        'project_id' => $projectId,
                        'user_id' => $userId,
                        'role' => $departmentMemberEntity->getRole()->getValue(),
                        'department_id' => $departmentMemberEntity->getTargetId(),
                    ]);
                    return true;
                }
            }
        }

        $this->logger->warning('User does not have share permission for topic', [
            'topic_id' => $resourceId,
            'project_id' => $projectId,
            'user_id' => $userId,
            'project_creator_id' => $projectEntity->getUserId(),
        ]);

        return false;
    }

    public function hasManageSharePermission(string $shareCreatorId, string $userId, string $resourceId, string $organizationCode): bool
    {
        // 只有分享创建者才有权限管理（取消）分享
        return $shareCreatorId === $userId;
    }

    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array
    {
        $result = $this->workspaceAppService->getMessagesByTopicId((int) $resourceId, $page, $pageSize);
        if (empty($result)) {
            return [];
        }
        return $result;
    }

    public function getResourceName(string $resourceId): string
    {
        return $this->workspaceAppService->getTopicDetail((int) $resourceId);
    }

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
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return string 资源名称
     */
    public function getResourceNameForDetail(ResourceShareEntity $shareEntity): string
    {
        // Topic 类型：resource_id 就是话题ID，直接使用
        return $this->getResourceName($shareEntity->getResourceId());
    }
}
