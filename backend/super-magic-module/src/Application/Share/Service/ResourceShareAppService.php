<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Service;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Share\Factory\ShareableResourceFactory;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\PasswordCrypt;
use Dtyq\SuperMagic\Interfaces\Share\Assembler\ShareAssembler;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareDetailDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\ResourceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemWithPasswordDTO;
use Exception;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * 资源分享应用服务.
 */
class ResourceShareAppService extends AbstractShareAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private ShareableResourceFactory $resourceFactory,
        private ResourceShareDomainService $shareDomainService,
        private ShareAssembler $shareAssembler,
        public readonly LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 创建分享.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param CreateShareRequestDTO $dto 创建分享请求DTO
     * @return ShareItemDTO 分享项目DTO
     * @throws Exception 创建分享异常
     */
    public function createShare(MagicUserAuthorization $userAuthorization, CreateShareRequestDTO $dto): ShareItemDTO
    {
        $resourceId = $dto->resourceId;
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 验证资源类型
        $resourceType = ResourceType::from($dto->resourceType);

        // 1. 获取对应类型的资源工厂
        try {
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }

        // 2. 验证资源是否存在且可分享
        if (! $factory->isResourceShareable($resourceId, $organizationCode)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found_or_not_shareable', [$resourceId]);
        }

        // 3. 验证资源所有者权限
        if (! $factory->hasSharePermission($resourceId, $userId, $organizationCode)) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission_to_share', [$resourceId]);
        }

        // 4. 保存分享（创建或更新）- 使用领域服务
        $attributes = [
            'resource_name' => $factory->getResourceName($resourceId),
            'share_type' => $dto->shareType ?? ShareAccessType::Internet->value,
        ];

        try {
            $savedEntity = $this->shareDomainService->saveShare(
                $resourceId,
                $resourceType->value,
                $userId,
                $organizationCode,
                $attributes,
                $dto->password,
                $dto->expireDays
            );
        } catch (Exception $e) {
            $this->logger->error('保存话题分享失败，结果: ' . $e->getMessage());
            ExceptionBuilder::throw(ShareErrorCode::CREATE_RESOURCES_ERROR, 'share.create_resources_error', [$resourceId]);
        }

        // 5. 构建响应
        return $this->shareAssembler->toDto($savedEntity);
    }

    /**
     * 取消分享.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param int $shareId 分享ID
     * @return bool 是否成功
     * @throws Exception 取消分享时发生异常
     */
    public function cancelShare(MagicUserAuthorization $userAuthorization, int $shareId): bool
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 调用领域服务的取消分享方法
        return $this->shareDomainService->cancelShare($shareId, $userId, $organizationCode);
    }

    public function cancelShareByResourceId(MagicUserAuthorization $userAuthorization, string $resourceId): bool
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        $shareEntity = $this->shareDomainService->getShareByResourceId($resourceId);
        if (is_null($shareEntity)) {
            return false;
        }
        // 调用领域服务的取消分享方法
        return $this->shareDomainService->cancelShare($shareEntity->getId(), $userId, $organizationCode);
    }

    public function checkShare(?MagicUserAuthorization $userAuthorization, string $shareCode): array
    {
        $shareEntity = $this->shareDomainService->getShareByCode($shareCode);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }
        return [
            'has_password' => ! empty($shareEntity->getPassword()),
            'user_id' => ! is_null($userAuthorization) ? $userAuthorization->getId() : '',
        ];
    }

    public function getShareDetail(?MagicUserAuthorization $userAuthorization, string $shareCode, GetShareDetailDTO $detailDTO): array
    {
        // 先获取详情内容
        $shareEntity = $this->shareDomainService->getShareByCode($shareCode);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 校验权限，目前只有个人才有权限控制
        if ($shareEntity->getShareType() == ShareAccessType::SelfOnly->value
            && ($userAuthorization === null || $shareEntity->getCreatedUid() != $userAuthorization->getId())) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
        }

        // 判断密码是否正确
        if (! empty($shareEntity->getPassword()) && ($detailDTO->getPassword() != PasswordCrypt::decrypt($shareEntity->getPassword()))) {
            ExceptionBuilder::throw(ShareErrorCode::PASSWORD_ERROR, 'share.password_error', [$shareCode]);
        }

        // 调用工厂类，获取分 享内容数据
        try {
            $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }

        // 返回数据
        return [
            'resource_type' => $resourceType,
            'resource_name' => $shareEntity->getResourceName(),
            'temporary_token' => AccessTokenUtil::generate((string) $shareEntity->getId(), $shareEntity->getOrganizationCode()),
            'data' => $factory->getResourceContent(
                $shareEntity->getResourceId(),
                $shareEntity->getCreatedUid(),
                $shareEntity->getOrganizationCode(),
                $detailDTO->getPage(),
                $detailDTO->getPageSize()
            ),
        ];
    }

    public function getShareList(MagicUserAuthorization $userAuthorization, ResourceListRequestDTO $dto): array
    {
        $conditions = ['created_uid' => $userAuthorization->getId()];
        if (! empty($dto->getKeyword())) {
            $conditions['keyword'] = $dto->getKeyword();
        }
        $result = $this->shareDomainService->getShareList($dto->getPage(), $dto->getPageSize(), $conditions);

        if (empty($result)) {
            return [
                'total' => 0,
                'list' => [],
            ];
        }

        // 扩展信息
        try {
            $resourceType = ResourceType::from($dto->getResourceType());
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }
        $result['list'] = $factory->getResourceExtendList($result['list']);
        return $result;
    }

    /**
     * 通过分享code获取分享信息（不含密码）.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ShareItemDTO 分享项目DTO
     * @throws Exception 获取分享信息异常
     */
    public function getShareByCode(?MagicUserAuthorization $userAuthorization, string $shareCode): ShareItemDTO
    {
        // 获取并验证实体
        $shareEntity = $this->getAndValidateShareEntity($userAuthorization, $shareCode);

        // 使用装配器创建基础DTO（不含密码）
        return $this->shareAssembler->toDto($shareEntity);
    }

    /**
     * 通过分享code获取分享信息（含明文密码）.
     * 注意：此方法仅应在特定场景下使用，需谨慎处理返回的密码信息.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ShareItemWithPasswordDTO 包含密码的分享项目DTO
     * @throws Exception 获取分享信息异常
     */
    public function getShareWithPasswordByCode(?MagicUserAuthorization $userAuthorization, string $shareCode): ShareItemWithPasswordDTO
    {
        // 获取并验证实体
        try {
            $shareEntity = $this->getAndValidateShareEntity($userAuthorization, $shareCode);
            //            if ($shareEntity->getCreatedUid() !== $userAuthorization->getId()) {
            //                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
            //            }
            // 使用装配器创建包含密码的DTO
            return $this->shareAssembler->toDtoWithPassword($shareEntity);
        } catch (BusinessException $e) {
            return new ShareItemWithPasswordDTO();
        }
    }

    /**
     * 根据分享代码获取分享实体.
     *
     * @param string $shareCode 分享代码
     * @return null|ResourceShareEntity 分享实体，如果不存在则返回null
     */
    public function getShare(string $shareCode): ?ResourceShareEntity
    {
        return $this->shareDomainService->getShareByCode($shareCode);
    }

    /**
     * 获取并验证分享实体.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ResourceShareEntity 验证通过的分享实体
     * @throws Exception 如果验证失败
     */
    private function getAndValidateShareEntity(?MagicUserAuthorization $userAuthorization, string $shareCode): ResourceShareEntity
    {
        // 通过领域服务获取分享实体
        $shareEntity = $this->shareDomainService->getShareByCode($shareCode);

        // 验证分享是否存在
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 校验权限，如果分享类型是仅自己可见，则需要验证用户身份
        if ($shareEntity->getShareType() == ShareAccessType::SelfOnly->value
            && ($userAuthorization === null || $shareEntity->getCreatedUid() != $userAuthorization->getId())) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
        }

        return $shareEntity;
    }
}
