<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Throwable;

/**
 * 访问令牌授权服务.
 * 负责验证访问 token 并创建临时用户授权对象.
 */
class AccessTokenAuthorizationService
{
    public function __construct(
        private readonly ResourceShareDomainService $resourceShareDomainService
    ) {
    }

    /**
     * 验证 token 并创建临时用户授权（基于分享创建者信息）.
     *
     * 该方法用于匿名访问场景，通过验证访问 token 来获取分享资源的创建者信息，
     * 并创建一个临时的用户授权对象，使得匿名用户能以分享创建者的身份访问资源。
     *
     * @param string $accessToken 访问 token
     * @return MagicUserAuthorization 用户授权对象
     * @throws Throwable 验证失败时抛出异常
     */
    public function validateTokenAndCreateUserAuthorization(string $accessToken): MagicUserAuthorization
    {
        // 1. 验证 token 有效性
        if (! AccessTokenUtil::validate($accessToken)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }

        // 2. 从 token 获取分享信息
        $shareId = AccessTokenUtil::getShareId($accessToken);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found');
        }

        // 3. 创建临时用户授权（基于分享创建者的身份信息）
        // 注意：这里使用分享创建者的 ID 和组织代码，使匿名用户能以创建者身份访问资源
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setId($shareEntity->getCreatedUid());
        $userAuthorization->setOrganizationCode($shareEntity->getOrganizationCode());

        return $userAuthorization;
    }

    /**
     * 验证 token 并检查下载权限.
     *
     * 该方法用于需要下载权限的场景，会验证分享实体的 extra 字段中的 allow_download_project_file 配置。
     * 如果配置为 false，则抛出权限拒绝异常。
     *
     * @param string $accessToken 访问 token
     * @return ResourceShareEntity 验证通过的分享实体
     * @throws Throwable 验证失败或权限不足时抛出异常
     */
    public function validateTokenAndCheckDownloadPermission(string $accessToken): ResourceShareEntity
    {
        // 1. 先调用现有方法验证 token 并获取分享实体（内部已包含 token 验证和分享实体查询）
        // 注意：这里我们只是为了获取分享实体，不需要使用返回的 userAuthorization
        $this->validateTokenAndCreateUserAuthorization($accessToken);

        // 2. 重新获取分享实体（或者可以修改 validateTokenAndCreateUserAuthorization 返回分享实体）
        $shareId = AccessTokenUtil::getShareId($accessToken);
        $shareEntity = $this->resourceShareDomainService->getValidShareById($shareId);

        // 3. 检查下载权限
        $allowDownload = $shareEntity->getExtraAttribute(
            CreateShareRequestDTO::EXTRA_FIELD_ALLOW_DOWNLOAD_PROJECT_FILE,
            true  // 默认值为 true，保持向后兼容
        );

        if ($allowDownload === false) {
            ExceptionBuilder::throw(ShareErrorCode::DOWNLOAD_NOT_ALLOWED, 'share.download_not_allowed');
        }

        return $shareEntity;
    }
}
