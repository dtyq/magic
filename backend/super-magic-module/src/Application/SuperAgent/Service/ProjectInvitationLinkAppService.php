<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Application\Chat\Service\MagicUserInfoAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Helper\InvitationPermissionMapper;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\PasswordCrypt;

/**
 * 项目邀请链接应用服务
 *
 * 负责协调项目邀请链接相关的业务逻辑
 */
class ProjectInvitationLinkAppService extends AbstractAppService
{
    public function __construct(
        private ResourceShareDomainService $resourceShareDomainService,
        private ProjectMemberDomainService $projectMemberDomainService,
        private ProjectDomainService $projectDomainService,
        private MagicUserInfoAppService $userInfoAppService
    ) {
    }

    /**
     * 获取项目邀请链接信息.
     */
    public function getInvitationLink(RequestContext $requestContext, string $projectId): ?array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 使用 ResourceShareDomainService 获取项目邀请分享
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId, // 限制为当前用户创建的分享
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            return null;
        }

        // 注意：这里不检查 isValid()，因为管理员需要看到所有状态的链接
        // is_enabled 状态会在响应中返回，让前端决定如何展示

        return $this->formatLinkResponse($shareEntity);
    }

    /**
     * 开启/关闭邀请链接.
     */
    public function toggleInvitationLink(RequestContext $requestContext, string $projectId, bool $enabled): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $organizationCode = $requestContext->getUserAuthorization()->getOrganizationCode();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $project = $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 查找现有的邀请分享 (通过 ResourceShareDomainService)
        $existingShare = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );
        if ($existingShare) {
            // 更新现有分享的启用/禁用状态
            $savedShare = $this->resourceShareDomainService->toggleShareStatus(
                $existingShare->getId(),
                $enabled,
                $currentUserId
            );
            return $this->formatLinkResponse($savedShare);
        }

        if (! $enabled) {
            // 如果不存在且要求关闭，抛出异常
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 3. 创建新的邀请分享 (通过 ResourceShareDomainService)
        $shareEntity = $this->resourceShareDomainService->saveShare(
            $projectId,
            ResourceType::ProjectInvitation->value,
            $currentUserId,
            $organizationCode,
            [
                'resource_name' => $project->getProjectName() . ' 邀请链接',
                'share_type' => InvitationPermissionMapper::permissionToShareType('view')->value,
            ],
            ResourceShareEntity::generateRandomPassword(), // 生成5位数字密码
            null // 永久有效
        );

        return $this->formatLinkResponse($shareEntity);
    }

    /**
     * 重置邀请链接.
     */
    public function resetInvitationLink(RequestContext $requestContext, string $projectId): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 获取现有邀请分享
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 3. 重新生成分享码（Token）
        $newShareCode = $this->resourceShareDomainService->generateShareCode();
        $shareEntity->setShareCode($newShareCode);
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($currentUserId);

        // 4. 保存更新
        $savedShare = $this->resourceShareDomainService->saveShareByEntity($shareEntity);

        return $this->formatLinkResponse($savedShare);
    }

    /**
     * 设置密码保护.
     */
    public function setPassword(RequestContext $requestContext, string $projectId, bool $enabled): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 获取现有邀请分享
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 3. 设置密码保护开关
        if ($enabled) {
            // 开启密码保护
            $password = $shareEntity->getPassword();
            $plainPassword = '';

            // 如果没有历史密码，生成新密码
            if (empty($password)) {
                $plainPassword = ResourceShareEntity::generateRandomPassword();
                $shareEntity->setPassword(PasswordCrypt::encrypt($plainPassword));
            } else {
                // 检查密码是否已加密，如果是明文则直接使用
                if (strlen($password) > 20) {
                    // 长度超过20的很可能是加密后的密码
                    try {
                        $plainPassword = PasswordCrypt::decrypt($password);
                    } catch (\Exception $e) {
                        // 解密失败，生成新密码
                        $plainPassword = ResourceShareEntity::generateRandomPassword();
                        $shareEntity->setPassword(PasswordCrypt::encrypt($plainPassword));
                    }
                } else {
                    // 短密码认为是明文密码
                    $plainPassword = $password;
                }
            }

            // 启用密码保护
            $shareEntity->setIsPasswordEnabled(true);
            $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $shareEntity->setUpdatedUid($currentUserId);

            $this->resourceShareDomainService->saveShareByEntity($shareEntity);

            return [
                'enabled' => true,
                'password' => $plainPassword,
            ];
        } else {
            // 关闭密码保护（保留密码）
            $shareEntity->setIsPasswordEnabled(false);
            $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $shareEntity->setUpdatedUid($currentUserId);

            $this->resourceShareDomainService->saveShareByEntity($shareEntity);

            return [
                'enabled' => false,
            ];
        }
    }

    /**
     * 重新设置密码
     */
    public function resetPassword(RequestContext $requestContext, string $projectId): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 获取现有邀请分享
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 3. 生成新密码
        $newPassword = ResourceShareEntity::generateRandomPassword();
        $this->resourceShareDomainService->saveShare(
            $shareEntity->getResourceId(),
            $shareEntity->getResourceType(),
            $currentUserId,
            $shareEntity->getOrganizationCode(),
            [
                'resource_name' => $shareEntity->getResourceName(),
                'share_type' => $shareEntity->getShareType(),
            ],
            $newPassword
        );

        return [
            'enabled' => true,
            'password' => $newPassword,
        ];
    }

    /**
     * 修改邀请链接密码
     */
    public function changePassword(RequestContext $requestContext, string $projectId, string $newPassword): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 验证密码长度（最大18位）
        if (strlen($newPassword) > 18 || strlen($newPassword) < 1) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_PASSWORD_INCORRECT);
        }

        // 3. 获取邀请链接
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 4. 更新密码并启用密码保护
        $shareEntity->setPassword(PasswordCrypt::encrypt($newPassword));
        $shareEntity->setIsPasswordEnabled(true);
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($currentUserId);

        $this->resourceShareDomainService->saveShareByEntity($shareEntity);

        return [
            'enabled' => true,
            'password' => $newPassword,
        ];
    }

    /**
     * 修改权限级别.
     */
    public function updatePermission(RequestContext $requestContext, string $projectId, string $permission): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();
        $projectIdInt = (int) $projectId;

        // 1. 验证项目权限
        $this->validateProjectOwner($projectIdInt, $currentUserId);

        // 2. 获取现有邀请分享
        $shareEntity = $this->resourceShareDomainService->getShareByResource(
            $currentUserId,
            $projectId,
            ResourceType::ProjectInvitation->value
        );

        if (! $shareEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 3. 验证并更新权限级别
        if (! in_array($permission, InvitationPermissionMapper::getAllPermissions())) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_INVALID_PERMISSION);
        }

        $shareType = InvitationPermissionMapper::permissionToShareType($permission);
        $shareEntity->setShareType($shareType->value);
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($currentUserId);

        // 4. 保存更新
        $this->resourceShareDomainService->saveShareByEntity($shareEntity);

        return [
            'permission' => $permission,
        ];
    }

    /**
     * 通过Token获取邀请信息（外部用户预览）.
     */
    public function getInvitationByToken(RequestContext $requestContext, string $token): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();

        // 1. 获取分享信息
        $shareEntity = $this->resourceShareDomainService->getShareByCode($token);
        if (! $shareEntity || $shareEntity->getResourceType() !== ResourceType::ProjectInvitation->value) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 2. 检查是否已启用
        if (! $shareEntity->getIsEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_DISABLED);
        }

        // 3. 检查是否有效（过期、删除等）
        if (! $shareEntity->isValid()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_INVALID);
        }

        $resourceId = $shareEntity->getResourceId();
        $projectId = (int) $resourceId;

        // 4. 获取项目信息
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_INVALID);
        }

        // 5. 提取创建者ID
        $creatorId = $project->getUserId();
        $isCreator = $creatorId === $currentUserId;

        // 6. 检查成员关系（短路评估：创建者无需检查）
        $hasJoined = $isCreator || $this->projectMemberDomainService->isProjectMemberByUser($projectId, $currentUserId);

        // 7. 获取创建者信息
        $creatorInfo = $this->getUserInfo($requestContext, $creatorId);

        return [
            'project_id' => $resourceId,
            'project_name' => $project->getProjectName(),
            'project_description' => $project->getProjectDescription() ?? '',
            'organization_code' => $project->getUserOrganizationCode() ?? '',
            'creator_id' => $creatorId,
            'creator_name' => $creatorInfo['name'] ?? '',
            'creator_avatar' => $creatorInfo['avatar'] ?? '',
            'permission' => InvitationPermissionMapper::shareTypeToPermission($shareEntity->getShareType()),
            'requires_password' => $shareEntity->getIsPasswordEnabled(),
            'token' => $shareEntity->getShareCode(),
            'has_joined' => $hasJoined,
        ];
    }

    /**
     * 加入项目（外部用户操作）.
     */
    public function joinProject(RequestContext $requestContext, string $token, ?string $password = null): array
    {
        $currentUserId = $requestContext->getUserAuthorization()->getId();

        // 1. 验证分享链接
        $shareEntity = $this->resourceShareDomainService->getShareByCode($token);
        if (! $shareEntity || $shareEntity->getResourceType() !== ResourceType::ProjectInvitation->value) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_NOT_FOUND);
        }

        // 2. 检查是否已启用
        if (! $shareEntity->getIsEnabled()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_DISABLED);
        }

        // 3. 检查是否有效（过期、删除等）
        if (! $shareEntity->isValid()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_INVALID);
        }

        // 4. 验证密码
        if ($shareEntity->getIsPasswordEnabled()) {
            // 链接启用了密码保护
            if (empty($password)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_PASSWORD_INCORRECT);
            }
            if (! $this->resourceShareDomainService->verifyPassword($shareEntity, $password)) {
                ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_PASSWORD_INCORRECT);
            }
        }

        // 4. 检查是否已经是项目成员（通过Domain服务）
        $isExistingMember = $this->projectMemberDomainService->isProjectMemberByUser(
            (int) $shareEntity->getResourceId(),
            $currentUserId
        );
        if ($isExistingMember) {
            ExceptionBuilder::throw(SuperAgentErrorCode::INVITATION_LINK_ALREADY_JOINED);
        }

        // 5. 添加为项目成员（通过Domain服务）
        $permission = InvitationPermissionMapper::shareTypeToPermission($shareEntity->getShareType());
        $memberRole = InvitationPermissionMapper::permissionToMemberRole($permission);

        // 使用Domain服务添加成员，符合DDD架构
        $memberEntity = $this->projectMemberDomainService->addMemberByInvitation(
            $shareEntity->getResourceId(),
            $currentUserId,
            $memberRole,
            $shareEntity->getOrganizationCode(),
            $shareEntity->getCreatedUid() // 邀请人（邀请链接创建者）
        );

        return [
            'project_id' => $shareEntity->getResourceId(),
            'user_role' => $memberRole->value,
            'permission' => $permission,
            'join_method' => 'link',
            'joined_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * 验证项目权限（项目所有者才能管理邀请链接）.
     */
    private function validateProjectOwner(int $projectId, string $currentUserId): object
    {
        $project = $this->projectDomainService->getProjectNotUserId($projectId);

        if (! $project || $project->getUserId() !== $currentUserId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED);
        }

        return $project;
    }

    /**
     * 获取用户信息.
     */
    private function getUserInfo(RequestContext $requestContext, string $userId): array
    {
        try {
            $organizationCode = $requestContext->getUserAuthorization()->getOrganizationCode();
            $dataIsolation = DataIsolation::create($organizationCode, $userId);

            $userInfoArray = $this->userInfoAppService->getUserInfo($userId, $dataIsolation);

            return [
                'name' => $userInfoArray['name'] ?? '',
                'avatar' => $userInfoArray['avatar_url'] ?? '',
            ];
        } catch (\Throwable $e) {
            // 如果获取用户信息失败，返回默认值
            return [
                'name' => '',
                'avatar' => '',
            ];
        }
    }

    /**
     * 格式化分享链接响应（管理员视角）.
     */
    private function formatLinkResponse(ResourceShareEntity $shareEntity): array
    {
        return [
            'id' => (string) $shareEntity->getId(),
            'project_id' => $shareEntity->getResourceId(),
            'token' => $shareEntity->getShareCode(),
            'is_enabled' => $shareEntity->getIsEnabled(), // 使用专门的启用/禁用字段
            'password' => $this->resourceShareDomainService->getDecryptedPassword($shareEntity),
            'permission' => InvitationPermissionMapper::shareTypeToPermission($shareEntity->getShareType()),
            'created_by' => $shareEntity->getCreatedUid(),
            'created_at' => $shareEntity->getCreatedAt(),
        ];
    }

}
