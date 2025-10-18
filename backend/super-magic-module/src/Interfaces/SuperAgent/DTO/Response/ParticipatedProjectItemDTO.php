<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 参与项目条目DTO (扩展自ProjectItemDTO，添加参与项目特有字段).
 */
class ParticipatedProjectItemDTO extends ProjectItemDTO
{
    public function __construct(
        // 继承父类的所有字段
        string $id,
        string $workspaceId,
        string $projectName,
        string $projectDescription,
        string $workDir,
        string $currentTopicId,
        string $currentTopicStatus,
        string $projectStatus,
        ?string $projectMode,
        ?string $workspaceName,
        ?string $createdAt,
        ?string $updatedAt,
        ?string $tag,
        ?string $userId,
        ?bool $isCollaborationEnabled,
        ?string $defaultJoinPermission,

        // 参与项目特有字段
        public readonly string $role = 'owner', // 用户在项目中的角色：owner-项目所有者，collaborator-协作者
        public readonly bool $isPinned = false,
        public readonly string $organizationCode = '',
    ) {
        parent::__construct(
            $id,
            $workspaceId,
            $projectName,
            $projectDescription,
            $workDir,
            $currentTopicId,
            $currentTopicStatus,
            $projectStatus,
            $projectMode,
            $workspaceName,
            $createdAt,
            $updatedAt,
            $tag,
            $userId,
            $isCollaborationEnabled,
            $defaultJoinPermission
        );
    }

    /**
     * Create DTO from array data.
     */
    public static function fromArray(array $data, ?string $workspaceName = null, bool $hasProjectMember = false): self
    {
        $isCollaborator = (bool) ($data['is_collaborator'] ?? false);

        // Tag logic: 判断项目是否被共享（是否有协作者）
        $tag = $hasProjectMember ? 'collaboration' : '';

        // Role logic: 当前用户在项目中的角色
        $role = $isCollaborator ? 'collaborator' : 'owner';

        return new self(
            id: (string) $data['id'],
            workspaceId: (string) $data['workspace_id'],
            projectName: $data['project_name'] ?? '',
            projectDescription: $data['project_description'] ?? '',
            workDir: $data['work_dir'] ?? '',
            currentTopicId: (string) ($data['current_topic_id'] ?? ''),
            currentTopicStatus: self::convertStatus($data['current_topic_status'] ?? ''),
            projectStatus: self::convertStatus($data['project_status'] ?? ''),
            projectMode: $data['project_mode'] ?? 'default',
            workspaceName: $workspaceName,
            createdAt: $data['created_at'] ?? null,
            updatedAt: $data['updated_at'] ?? null,
            tag: $tag,
            userId: $data['user_id'] ?? '',
            role: $role,
            isPinned: (bool) ($data['is_pinned'] ?? false),
            organizationCode: $data['organization_code'] ?? '',
            isCollaborationEnabled: (bool) ($data['is_collaboration_enabled'] ?? false),
            defaultJoinPermission: $data['default_join_permission'] ?? '',
        );
    }

    /**
     * 转换为数组 (包含参与项目特有字段).
     */
    public function toArray(): array
    {
        return array_merge(parent::toArray(), [
            'role' => $this->role,
            'is_pinned' => $this->isPinned,
            'organization_code' => $this->organizationCode,
        ]);
    }

    /**
     * Convert status value to string.
     */
    private static function convertStatus(mixed $status): string
    {
        return (string) $status;
    }
}
