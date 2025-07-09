<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\PasswordCrypt;
use Dtyq\SuperMagic\Infrastructure\Utils\ShareCodeGenerator;
use Exception;

/**
 * 资源分享领域服务.
 */
class ResourceShareDomainService
{
    public function __construct(
        protected ResourceShareRepositoryInterface $shareRepository
    ) {
    }

    /**
     * 取消分享（逻辑删除）.
     *
     * @param int $shareId 分享ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return bool 是否取消成功
     * @throws Exception 如果取消分享失败
     */
    public function cancelShare(int $shareId, string $userId, string $organizationCode): bool
    {
        // 1. 获取分享实体
        $shareEntity = $this->shareRepository->getShareById($shareId);

        // 2. 验证分享是否存在
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND, 'share.not_found', [$shareId]);
        }

        // 3. 验证是否有权限取消分享（只有分享创建者或管理员可以取消）
        if ($shareEntity->getCreatedUid() !== $userId) {
            // 这里可以添加额外的权限检查，例如检查用户是否是管理员
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission_to_cancel', [$shareId]);
        }

        // 4. 验证组织是否匹配
        if ($shareEntity->getOrganizationCode() !== $organizationCode) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.organization_mismatch', [$shareId]);
        }

        // 5. 设置删除时间和更新信息
        $shareEntity->setDeletedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($userId);

        // 6. 保存实体
        try {
            $this->shareRepository->save($shareEntity);
            return true;
        } catch (Exception $e) {
            // 重新抛出异常
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED, 'share.cancel_failed', [$shareId]);
        }
    }

    /**
     * 获取分享详情.
     *
     * @param string $resourceId 资源ID
     * @return null|ResourceShareEntity 分享实体
     */
    public function getShareByResourceId(string $resourceId): ?ResourceShareEntity
    {
        return $this->shareRepository->getShareByResourceId($resourceId);
    }

    public function getShareByCode(string $code): ?ResourceShareEntity
    {
        return $this->shareRepository->getShareByCode($code);
    }

    /**
     * 获取有效的分享
     * 有效分享是指未删除且未过期的分享.
     *
     * @param string $shareId 分享ID
     * @return null|ResourceShareEntity 分享实体
     */
    public function getValidShareById(string $shareId): ?ResourceShareEntity
    {
        $share = $this->shareRepository->getShareById((int) $shareId);

        if (! $share || ! $share->isValid()) {
            return null;
        }

        return $share;
    }

    /**
     * 通过分享码获取有效分享.
     *
     * @param string $shareCode 分享码
     * @return null|ResourceShareEntity 分享实体
     */
    public function getValidShareByCode(string $shareCode): ?ResourceShareEntity
    {
        $share = $this->shareRepository->getShareByCode($shareCode);

        if (! $share || ! $share->isValid()) {
            return null;
        }

        return $share;
    }

    /**
     * 增加分享查看次数.
     *
     * @param string $shareId 分享ID
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareId): bool
    {
        $share = $this->shareRepository->getShareById((int) $shareId);

        if (! $share) {
            return false;
        }

        $share->incrementViewCount();
        $this->shareRepository->save($share);

        return true;
    }

    public function getShareList(int $page, int $pageSize, array $conditions = [], string $select = '*'): array
    {
        // 定义需要返回的字段列表
        $allowedFields = [
            'id', 'resource_id', 'resource_name', 'resource_type',
            'created_at', 'created_uid', 'share_type',
        ];

        $result = $this->shareRepository->paginate($conditions, $page, $pageSize);
        // 过滤字段
        $filteredList = [];
        foreach ($result['list'] as $item) {
            $filteredItem = [];
            // 将实体转为数组
            $itemArray = $item instanceof ResourceShareEntity ? $item->toArray() : (array) $item;
            // 只保留允许的字段
            foreach ($allowedFields as $field) {
                if (isset($itemArray[$field])) {
                    $filteredItem[$field] = $itemArray[$field];
                }
            }

            $filteredList[] = $filteredItem;
        }
        return ['total' => $result['total'], 'list' => $filteredList];
    }

    /**
     * 保存分享（创建或更新）.
     *
     * @param string $resourceId 资源ID
     * @param int $resourceType 资源类型
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param array $attributes 额外属性
     * @param null|string $password 密码（可选）
     * @param null|int $expireDays 过期时间（可选）
     * @return ResourceShareEntity 保存后的分享实体
     * @throws Exception 如果操作失败
     */
    public function saveShare(
        string $resourceId,
        int $resourceType,
        string $userId,
        string $organizationCode,
        array $attributes = [],
        ?string $password = null,
        ?int $expireDays = null
    ): ResourceShareEntity {
        // 1. 查找是否已存在分享
        $shareEntity = $this->findExistingShare($resourceId, $resourceType, $userId);

        // 2. 如果不存在，创建新的分享实体
        if (! $shareEntity) {
            // 生成分享码
            // 暂时使用 resource_id 代替 分享码
            $shareCode = $resourceId;

            // 构建基本分享数据
            $shareData = [
                'resource_id' => $resourceId,
                'resource_type' => $resourceType,
                'resource_name' => $attributes['resource_name'],
                'share_code' => $shareCode,
                'share_type' => $attributes['share_type'] ?? 0,
                'created_uid' => $userId,
                'organization_code' => $organizationCode,
            ];

            // 创建新实体
            $shareEntity = new ResourceShareEntity($shareData);

            // 设置创建时间
            $shareEntity->setCreatedAt(date('Y-m-d H:i:s'));
        }

        // 3. 更新实体属性（无论是新建还是已存在）
        // 更新分享类型（如果提供）
        if (isset($attributes['share_type'])) {
            $shareEntity->setShareType($attributes['share_type']);
        }

        // 设置密码（如果提供）
        if (! empty($password)) {
            // 使用可逆加密替代单向哈希
            $shareEntity->setPassword(PasswordCrypt::encrypt($password));
        } else {
            $shareEntity->setPassword('');
        }

        // 设置过期时间（如果提供）
        if ($expireDays > 0) {
            // 确保过期时间是字符串格式
            $expireAt = date('Y-m-d H:i:s', strtotime("+{$expireDays} days"));
            $shareEntity->setExpireAt($expireAt);
        }

        // 设置更新信息
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($userId);
        $shareEntity->setDeletedAt(null);

        // 4. 保存实体
        try {
            return $this->shareRepository->save($shareEntity);
        } catch (Exception $e) {
            // 重新抛出异常
            ExceptionBuilder::throw(
                ShareErrorCode::OPERATION_FAILED,
                'share.save_failed',
                [$shareEntity->getId() ?: '(new)']
            );
        }
    }

    /**
     * 生成分享码.
     *
     * @return string 生成的分享码
     */
    public function generateShareCode(): string
    {
        return (new ShareCodeGenerator())->generate();
    }

    /**
     * 获取解密后的分享密码
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return string 解密后的密码
     */
    public function getDecryptedPassword(ResourceShareEntity $shareEntity): string
    {
        $encryptedPassword = $shareEntity->getPassword();
        if (empty($encryptedPassword)) {
            return '';
        }

        return PasswordCrypt::decrypt($encryptedPassword);
    }

    /**
     * 验证分享密码是否正确.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param string $password 要验证的密码
     * @return bool 密码是否正确
     */
    public function verifyPassword(ResourceShareEntity $shareEntity, string $password): bool
    {
        if (empty($shareEntity->getPassword())) {
            return true; // 无密码分享，直接返回验证通过
        }

        $decryptedPassword = $this->getDecryptedPassword($shareEntity);
        return $decryptedPassword === $password;
    }

    /**
     * 查找已存在的分享.
     *
     * @param string $resourceId 资源ID
     * @param int $resourceType 资源类型
     * @param string $userId 用户ID
     * @return null|ResourceShareEntity 如果存在则返回分享实体，否则返回null
     */
    protected function findExistingShare(string $resourceId, int $resourceType, string $userId): ?ResourceShareEntity
    {
        return $this->shareRepository->getShareByResource($userId, $resourceId, $resourceType);
    }
}
