<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade\FileCollectionItemRepositoryInterface;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Entity\ValueObject\Query\SimilarQueryCondition;
use Dtyq\SuperMagic\Domain\Share\Repository\Facade\ResourceShareRepositoryInterface;
use Dtyq\SuperMagic\Domain\Share\Repository\ValueObject\ResourceShareQueryVO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\DateFormatUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\PasswordCrypt;
use Dtyq\SuperMagic\Infrastructure\Utils\ShareCodeGenerator;
use Exception;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;

/**
 * 资源分享领域服务.
 */
class ResourceShareDomainService
{
    public function __construct(
        protected ResourceShareRepositoryInterface $shareRepository,
        protected MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        protected FileCollectionItemRepositoryInterface $fileCollectionItemRepository,
        protected ProjectMemberDomainService $projectMemberDomainService,
        protected ProjectRepositoryInterface $projectRepository,
        protected TaskFileRepositoryInterface $taskFileRepository,
        protected FileCollectionDomainService $fileCollectionDomainService,
        protected LoggerInterface $logger
    ) {
    }

    public function saveShareByEntity(ResourceShareEntity $shareEntity): ResourceShareEntity
    {
        try {
            return $this->shareRepository->save($shareEntity);
        } catch (Exception $e) {
            // 重新抛出异常
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED, 'share.cancel_failed: ' . $shareEntity->getId());
        }
    }

    /**
     * 批量保存分享实体.
     *
     * @param array $shareEntities ResourceShareEntity[] 分享实体数组
     * @return bool 是否保存成功
     */
    public function batchSaveShareEntities(array $shareEntities): bool
    {
        if (empty($shareEntities)) {
            return true;
        }

        try {
            return $this->shareRepository->batchSave($shareEntities);
        } catch (Exception $e) {
            // 重新抛出异常
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED, 'share.batch_save_failed: ' . $e->getMessage());
        }
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

    /**
     * 通过资源ID获取分享（包括已删除的记录）.
     *
     * @param string $resourceId 资源ID
     * @return null|ResourceShareEntity 分享实体
     */
    public function getShareByResourceIdWithTrashed(string $resourceId): ?ResourceShareEntity
    {
        return $this->shareRepository->getShareByResourceIdWithTrashed($resourceId);
    }

    /**
     * 批量获取分享详情.
     *
     * @param array $resourceIds 资源ID数组
     * @return array ResourceShareEntity[] 分享实体数组
     */
    public function getSharesByResourceIds(array $resourceIds): array
    {
        if (empty($resourceIds)) {
            return [];
        }

        return $this->shareRepository->getSharesByResourceIds($resourceIds);
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
     * 通过资源ID获取有效分享.
     * 有效分享是指未删除且未过期的分享.
     *
     * @param string $resourceId 资源ID
     * @return null|ResourceShareEntity 分享实体
     */
    public function getValidShareByResourceId(string $resourceId): ?ResourceShareEntity
    {
        $share = $this->shareRepository->getShareByResourceId($resourceId);

        if (! $share || ! $share->isValid()) {
            return null;
        }

        return $share;
    }

    /**
     * 增加分享查看次数（使用数据库原子操作，解决并发问题）.
     *
     * @param string $shareId 分享ID
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareId): bool
    {
        // 使用数据库原子操作 increment，避免 Read-Modify-Write 并发问题
        // 直接通过 shareId 更新，无需先查询实体，性能更好且线程安全
        return $this->shareRepository->incrementViewCountByShareId((int) $shareId);
    }

    public function getShareList(int $page, int $pageSize, array $conditions = [], string $select = '*'): array
    {
        // 定义需要返回的字段列表
        $allowedFields = [
            // 基础信息
            'id',
            'resource_id',
            'resource_name',
            'resource_type',
            'created_at',               // 分享时间 (shared_at)
            'created_uid',
            'share_type',
            'project_id',
            'default_open_file_id',     // 用于动态设置文件集的 resource_name

            // 统计和状态字段
            'view_count',               // 查看次数 (share_count)
            'expire_at',                // 过期时间
            'expire_days',              // 过期天数（1-365天，null表示永久有效）
            'is_password_enabled',      // 是否开启密码保护 (has_password)
            'password',                 // 密码（加密存储，需要在 AppService 层解密）
            'copy_count',               // 复制项目次数（文件集类型和单文件类型）

            // 辅助字段
            'share_code',               // 分享码
            'is_enabled',               // 是否启用
            'share_project',            // 是否分享整个项目
            'deleted_at',               // 删除时间
        ];

        // 将数组条件转换为 VO
        $queryVO = ResourceShareQueryVO::fromArray($conditions);

        $result = $this->shareRepository->paginate($queryVO, $page, $pageSize);
        // 过滤字段
        // 注意：Repository 现在统一返回数组结构（方案2优化），所以直接使用数组即可
        $filteredList = [];
        foreach ($result['list'] as $item) {
            $filteredItem = [];
            // Repository 统一返回数组，直接使用
            $itemArray = (array) $item;

            // 只保留允许的字段，确保所有字段都存在（null 值也返回）
            // 根据数据库字段类型处理：varchar NOT NULL 字段返回空字符串，NULL 字段返回 null
            foreach ($allowedFields as $field) {
                // copy_count 字段特殊处理：如果不存在则默认为 0
                if ($field === 'copy_count') {
                    $filteredItem[$field] = isset($itemArray[$field]) ? (int) $itemArray[$field] : 0;
                } elseif (in_array($field, ['resource_id', 'share_code', 'created_uid', 'updated_uid', 'organization_code'], true)) {
                    // varchar NOT NULL 字段：如果不存在或为 null，返回空字符串（符合数据库字段类型）
                    $filteredItem[$field] = $itemArray[$field] ?? '';
                } elseif ($field === 'resource_name') {
                    // resource_name 字段：优先返回 resource_name，如果为空则返回空字符串
                    $value = $itemArray[$field] ?? '';
                    $filteredItem[$field] = $value !== '' ? $value : '';
                } elseif ($field === 'password') {
                    // password 字段：返回加密的密码（空字符串表示没有密码）
                    $filteredItem[$field] = $itemArray[$field] ?? '';
                } elseif ($field === 'expire_at') {
                    // expire_at 字段：格式化日期为 Y/m/d 格式
                    $filteredItem[$field] = DateFormatUtil::formatExpireAt($itemArray[$field] ?? null);
                } else {
                    // NULL 字段：可以返回 null（如 project_id, default_open_file_id, share_range 等）
                    $filteredItem[$field] = $itemArray[$field] ?? null;
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
     * @param null|string $projectId 项目ID（可选）
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
        ?int $expireDays = null,
        ?string $projectId = null
    ): ResourceShareEntity {
        // 1. 查找是否已存在分享（通过 resource_id 查询，不校验 resource_type）
        // 这样可以避免类型转换(13↔12)时查询失败
        $shareEntity = $this->getShareByResourceId($resourceId);

        // 2. 如果不存在，创建新的分享实体
        if (! $shareEntity) {
            // 生成分享码：share_code = resource_id
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

            // 设置项目ID（如果提供）
            if ($projectId !== null) {
                $shareData['project_id'] = $projectId;
            }

            // 创建新实体
            $shareEntity = new ResourceShareEntity($shareData);

            // 设置创建时间
            $shareEntity->setCreatedAt(date('Y-m-d H:i:s'));
        }

        // 3. 更新实体属性（无论是新建、更新还是复活软删除记录）
        // 更新/复活时验证：resource_id 应该和已存在记录一致
        if ($shareEntity->getResourceId() !== $resourceId) {
            // resource_id 不应该改变，如果改变了说明传递错误
            ExceptionBuilder::throw(
                ShareErrorCode::PARAMETER_CHECK_FAILURE,
                'share.resource_id_cannot_change_during_update',
                [
                    'existing_resource_id' => $shareEntity->getResourceId(),
                    'new_resource_id' => $resourceId,
                ]
            );
        }

        // 更新资源类型（确保与传入的 resourceType 一致）
        $shareEntity->setResourceType($resourceType);

        // share_code 更新规则：
        // - 更新时保持 share_code 不变，确保分享链接固定
        // - share_code = resource_id（固定规则）

        // 更新分享类型（如果提供）
        if (isset($attributes['share_type'])) {
            $shareEntity->setShareType($attributes['share_type']);
        }

        // 更新额外属性（如果提供）
        if (isset($attributes['extra'])) {
            $shareEntity->setExtra($attributes['extra']);
        }

        // 设置默认打开的文件ID（如果提供）
        if (array_key_exists('default_open_file_id', $attributes)) {
            $shareEntity->setDefaultOpenFileId($attributes['default_open_file_id']);
        }

        // 设置资源名称（用作分享标题）- 使用 array_key_exists 确保即使值为空字符串也能更新
        if (array_key_exists('resource_name', $attributes)) {
            $shareEntity->setResourceName($attributes['resource_name']);
        }

        // 设置是否分享整个项目
        if (isset($attributes['share_project'])) {
            $shareEntity->setShareProject((bool) $attributes['share_project']);
        }

        // 设置分享范围（share_type=2 时使用）
        if (isset($attributes['share_range'])) {
            $shareEntity->setShareRange($attributes['share_range']);
        } elseif ($shareEntity->getShareType() != ShareAccessType::TeamShare->value) {
            // 非团队分享模式时清空 share_range
            $shareEntity->setShareRange(null);
        }

        // 设置指定成员/部门/群组（share_type=2 + share_range=designated 时使用）
        $needsTargetIds = $shareEntity->getShareType() == ShareAccessType::TeamShare->value
            && $shareEntity->getShareRange() === 'designated';

        if ($needsTargetIds) {
            // 需要 target_ids：如果传递了则设置，不传则保持原值（更新场景）
            if (isset($attributes['target_ids']) && is_array($attributes['target_ids'])) {
                $shareEntity->setTargetIdsArray($attributes['target_ids']);
            }
        // else: 不传 target_ids，保持原值（更新场景）或使用默认空数组（创建场景已在 AppService 处理）
        } else {
            // 不需要 target_ids 时清空（share_type != 2 或 share_range != 'designated'）
            $shareEntity->setTargetIdsArray([]);
        }

        // 设置项目ID（如果提供）
        if ($projectId !== null) {
            $shareEntity->setProjectId($projectId);
        }

        // 根据 share_type 处理密码字段
        $currentShareType = $shareEntity->getShareType();

        if ($currentShareType == ShareAccessType::PasswordProtected->value) {
            // share_type=5（密码保护）：密码必填，设置或更新密码
            if (! empty($password)) {
                $shareEntity->setPassword(PasswordCrypt::encrypt($password));
                $shareEntity->setIsPasswordEnabled(true);
            }
        // 如果不传密码，保持原密码（DTO 验证会确保创建时密码必填）
        } else {
            // share_type=2（团队内）或 share_type=4（公开访问）：自动清空密码
            $shareEntity->setPassword(null);
            $shareEntity->setIsPasswordEnabled(false);
        }

        // 判断是创建还是更新场景（通过 id 判断：id > 0 表示从数据库查询出来的，是更新场景）
        $isCreate = ($shareEntity->getId() === 0);

        // 确定当前时间（用于更新场景计算 expire_at）
        $currentTime = date('Y-m-d H:i:s');

        // 设置过期时间和过期天数
        // 统一语义：
        // - attributes 中不存在 'expire_days' 字段：不传，保持原值
        // - attributes 中存在 'expire_days' 字段：
        //   - 值为 null 或 0 或空字符串：传了清空标识，清空过期时间和过期天数（永久有效）
        //   - 值 > 0：传了有效值
        //     - 创建场景：基于 created_at（或当前时间）加上 expire_days 计算 expire_at
        //     - 更新场景：
        //       - 如果 expire_days 相同，不修改 expire_at 和 expire_days（保持原值）
        //       - 如果 expire_days 有变化，基于当前时间加上新的 expire_days 计算 expire_at
        // 通过检查 attributes 中是否存在 'expire_days' 字段来区分"不传递"和"传递 null"
        if (array_key_exists('expire_days', $attributes)) {
            // 字段已传递（可能是 null、0、空字符串或有效值）
            $expireDaysValue = $attributes['expire_days'];

            // 处理空字符串的情况（转换为 null）
            if ($expireDaysValue === '' || $expireDaysValue === '0') {
                $expireDaysValue = null;
            }

            if ($expireDaysValue !== null && $expireDaysValue > 0) {
                // 有效值：1-365天
                if ($isCreate) {
                    // 创建场景：基于 created_at（或当前时间）加上 expire_days 计算 expire_at
                    $baseTime = $shareEntity->getCreatedAt() ?: $currentTime;
                    $expireAt = date('Y-m-d H:i:s', strtotime("{$baseTime} +{$expireDaysValue} days"));
                    $shareEntity->setExpireAt($expireAt);
                    $shareEntity->setExpireDays($expireDaysValue);
                } else {
                    // 更新场景
                    $oldExpireDays = $shareEntity->getExpireDays();
                    // 如果 expire_days 有变化（包括从 null 变为有效值的情况），基于当前时间加上新的 expire_days 计算 expire_at
                    // 如果 expire_days 相同，不修改 expire_at 和 expire_days（保持原值，不进入 if 块）
                    if ($oldExpireDays === null || $oldExpireDays != $expireDaysValue) {
                        $expireAt = date('Y-m-d H:i:s', strtotime("{$currentTime} +{$expireDaysValue} days"));
                        $shareEntity->setExpireAt($expireAt);
                        $shareEntity->setExpireDays($expireDaysValue);
                    }
                }
            } else {
                // $expireDaysValue = null 或 0 或负数，清空过期时间和过期天数（永久有效）
                $shareEntity->setExpireAt(null);
                $shareEntity->setExpireDays(null); // 清空过期天数
            }
        }
        // else: attributes 中不存在 'expire_days' 字段，不传，保持原值

        // 设置更新信息（使用与计算 expire_at 相同的当前时间）
        $shareEntity->setUpdatedAt($currentTime);
        $shareEntity->setUpdatedUid($userId);
        // 复活软删除记录：如果是软删除的分享，设置 deleted_at=null 将其恢复
        $shareEntity->setDeletedAt(null);

        // 4. 保存实体
        return $this->shareRepository->save($shareEntity);
    }

    /**
     * 生成分享码.
     *
     * @return string 生成的分享码（12位随机字符）
     */
    public function generateShareCode(): string
    {
        return (new ShareCodeGenerator())
            ->setCodeLength(12) // 设置为12位
            ->generate();
    }

    /**
     * 根据ID重新生成分享码.
     *
     * @param int $shareId 分享ID
     * @throws Exception 如果操作失败
     */
    public function regenerateShareCodeById(int $shareId): ResourceShareEntity
    {
        // 1. 获取分享实体
        $shareEntity = $this->shareRepository->getShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND);
        }

        // 3. 重新生成分享码
        $newShareCode = $this->generateShareCode();
        $shareEntity->setShareCode($newShareCode);
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // 4. 保存更新
        try {
            $this->shareRepository->save($shareEntity);
            return $shareEntity;
        } catch (Exception $e) {
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED);
        }
    }

    /**
     * 修改密码.
     *
     * @param int $shareId 分享ID
     * @throws Exception 如果操作失败
     */
    public function changePasswordById(int $shareId, string $password): ResourceShareEntity
    {
        // 1. 获取分享实体
        $shareEntity = $this->shareRepository->getShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND);
        }

        // 3. 设置密码
        if (! empty($password)) {
            // 使用可逆加密替代单向哈希
            $shareEntity->setPassword(PasswordCrypt::encrypt($password));
        } else {
            $shareEntity->setPassword('');
        }
        $shareEntity->setIsPasswordEnabled((bool) $shareEntity->getPassword());
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        // 4. 保存更新
        try {
            $this->shareRepository->save($shareEntity);
            return $shareEntity;
        } catch (Exception $e) {
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED);
        }
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
     * 切换分享状态（启用/禁用）.
     *
     * @param int $shareId 分享ID
     * @param bool $enabled 是否启用
     * @param string $userId 操作用户ID
     * @return ResourceShareEntity 更新后的分享实体
     * @throws Exception 如果操作失败
     */
    public function toggleShareStatus(int $shareId, bool $enabled, string $userId): ResourceShareEntity
    {
        // 1. 获取分享实体
        $shareEntity = $this->shareRepository->getShareById($shareId);
        if (! $shareEntity) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND, 'share.not_found', [$shareId]);
        }

        // 2. 权限检查（只有创建者可以操作）
        if ($shareEntity->getCreatedUid() !== $userId) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission', [$shareId]);
        }

        // 3. 更新启用状态
        $shareEntity->setIsEnabled($enabled);
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($userId);

        // 4. 保存并返回
        try {
            return $this->shareRepository->save($shareEntity);
        } catch (Exception $e) {
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED, 'share.toggle_status_failed', [$shareId]);
        }
    }

    /**
     * 获取指定资源的分享.
     *
     * @param string $resourceId 资源ID
     * @param int $resourceType 资源类型
     * @return null|ResourceShareEntity 分享实体
     */
    public function getShareByResource(string $resourceId, int $resourceType): ?ResourceShareEntity
    {
        return $this->shareRepository->getShareByResource('', $resourceId, $resourceType, false);
    }

    /**
     * 删除指定资源的分享.
     *
     * @param string $resourceId 资源ID
     * @param int $resourceType 资源类型
     * @param string $userId 用户ID（可选，用于权限检查）
     * @param bool $forceDelete 是否强制删除（物理删除），默认false为软删除
     * @return bool 删除是否成功
     */
    public function deleteShareByResource(string $resourceId, int $resourceType, string $userId = '', bool $forceDelete = false): bool
    {
        $shareEntity = $this->shareRepository->getShareByResource($userId, $resourceId, $resourceType);
        if (! $shareEntity) {
            return true; // 如果不存在，视为删除成功
        }

        return $this->shareRepository->delete($shareEntity->getId(), $forceDelete);
    }

    /**
     * 删除指定分享码的分享.
     *
     * @param string $shareCode 分享码
     * @return bool 删除是否成功
     */
    public function deleteShareByCode(string $shareCode): bool
    {
        $shareEntity = $this->shareRepository->getShareByCode($shareCode);
        if (! $shareEntity) {
            return true; // 如果不存在，视为删除成功
        }

        return $this->shareRepository->delete($shareEntity->getId());
    }

    /**
     * 批量删除指定资源类型的分享.
     *
     * @param string $resourceId 资源ID
     * @param int $resourceType 资源类型
     * @return bool 删除是否成功
     */
    public function deleteAllSharesByResource(string $resourceId, int $resourceType): bool
    {
        try {
            // 这里可以扩展为批量删除，目前先用单个删除
            $shareEntity = $this->shareRepository->getShareByResource('', $resourceId, $resourceType);
            if (! $shareEntity) {
                return true;
            }
            return $this->shareRepository->delete($shareEntity->getId());
        } catch (Exception $e) {
            ExceptionBuilder::throw(ShareErrorCode::OPERATION_FAILED, 'share.delete_failed: ' . $resourceId);
        }
    }

    /**
     * 验证分享访问权限.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param null|string $userId 当前用户ID（可以为null）
     * @param null|string $userOrganizationCode 当前用户组织编码（可以为null）
     * @param string $shareCode 分享code（用于错误提示）
     * @throws Exception 如果权限验证失败
     */
    public function validateShareAccess(
        ResourceShareEntity $shareEntity,
        ?string $userId,
        ?string $userOrganizationCode,
        string $shareCode
    ): void {
        // 团队分享（share_type=2），根据 share_range 区分校验逻辑
        if ($shareEntity->getShareType() == ShareAccessType::TeamShare->value) {
            if ($userId === null || $userOrganizationCode === null) {
                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
            }

            // 必须是同一组织
            if ($shareEntity->getOrganizationCode() !== $userOrganizationCode) {
                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
            }

            $shareRange = $shareEntity->getShareRange();

            // share_range = "all" 时，同组织即可访问
            if ($shareRange === 'all') {
                return;
            }

            // share_range = "designated" 时，需要检查 target_ids
            if ($shareRange === 'designated') {
                // 创建者永远有权限访问自己创建的分享
                // 注意：$userId 在第746行已经保证不为 null（团队分享必须登录）
                if ($shareEntity->getCreatedUid() === $userId) {
                    return; // 创建者可以访问
                }

                // 协作者检查（需要 project_id）
                $projectId = $shareEntity->getProjectId();
                if ($projectId !== null && $projectId !== '') {
                    // 获取项目实体（如果项目不存在，返回 null，不会抛出异常）
                    $projectEntity = $this->projectRepository->findById((int) $projectId);

                    // 如果项目存在，检查协作者权限
                    if ($projectEntity !== null) {
                        // 如果用户不是项目创建者，检查是否是协作者
                        if ($projectEntity->getUserId() !== $userId) {
                            // 检查用户是否是项目成员（协作者）
                            $projectMemberEntity = $this->projectMemberDomainService->getMemberByProjectAndUser(
                                (int) $projectId,
                                $userId
                            );

                            // 如果是协作者，允许访问
                            if ($projectMemberEntity !== null) {
                                return; // 协作者可以访问
                            }
                        }
                    }
                    // 如果项目不存在（projectEntity === null），跳过协作者检查，继续检查 target_ids
                    // 原因：项目可能已被删除或不存在，但分享记录仍然存在（历史数据）
                    // 处理：静默跳过协作者检查，继续检查 target_ids，确保其他权限验证流程不受影响
                }
                // 如果 project_id 为 null，跳过协作者检查，继续检查 target_ids

                $targets = $shareEntity->getTargetIdsArray();

                // 如果 target_ids 为空，只有创建者可以访问（上面已检查，这里直接拒绝）
                if (empty($targets)) {
                    ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
                }

                // 解析 target_ids（新格式：target_type=User/Department, target_id=xxx）
                [$targetUserIds, $targetDepartmentIds] = $this->parseTargetIds($targets);

                // 用户直接命中
                if (in_array($userId, $targetUserIds, true)) {
                    return;
                }

                // 部门命中
                if (! empty($targetDepartmentIds)) {
                    // 特殊处理：-1 表示全部成员，同组织即可访问
                    if (in_array('-1', $targetDepartmentIds, true)) {
                        return;
                    }

                    $dataIsolation = ContactDataIsolation::create($userOrganizationCode, $userId);
                    $userDeptIds = $this->magicDepartmentUserDomainService
                        ->getDepartmentIdsByUserId($dataIsolation, $userId, true);

                    foreach ($userDeptIds as $deptId) {
                        if (in_array((string) $deptId, $targetDepartmentIds, true)) {
                            return;
                        }
                    }
                }

                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
            }

            // 默认情况下（未知 share_range），拒绝访问
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
        }

        // share_type=4 (Internet/公开访问) 和 share_type=5 (PasswordProtected/密码保护)
        // 不需要身份验证，直接放行。密码校验在 AppService 层处理（getShareDetail/getShareFiles）
    }

    /**
     * 根据文件ID列表查找文件集分享（返回所有匹配的分享）.
     *
     * 查找包含指定文件ID集合的文件集分享（resource_type=13，含单文件与多文件）.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param array $fileIds 文件ID数组
     * @return array ResourceShareEntity[] 找到的所有分享实体数组
     */
    public function findSharesByFileIds(
        string $userId,
        string $organizationCode,
        array $fileIds
    ): array {
        if (empty($fileIds)) {
            return [];
        }

        // 基本非空检查（权限验证由认证中间件保证）
        $userId = trim((string) $userId);
        $organizationCode = trim((string) $organizationCode);

        if (empty($userId) || empty($organizationCode)) {
            throw new InvalidArgumentException('用户ID或组织代码不能为空');
        }

        // 1. 查找包含这些文件的所有文件集（必须属于当前用户和组织）
        // 使用 SQL 查询：关联文件集表，确保文件集属于当前用户和组织
        $fileIdsInt = array_map('intval', $fileIds);
        // 去重并过滤无效值（防止无效文件ID导致SQL错误）
        $fileIdsInt = array_filter(array_unique($fileIdsInt), fn ($id) => $id > 0);

        if (empty($fileIdsInt)) {
            return [];
        }

        $fileCount = count($fileIdsInt);

        // 双重检查：确保fileCount > 0，防止SQL语法错误
        if ($fileCount <= 0) {
            return [];
        }

        $validShareEntities = [];

        // 使用统一的完全匹配查询（支持单文件和多文件场景）
        // Repository 层已完成完全匹配验证：文件集的文件数量和内容与传入列表完全一致
        $collectionIds = $this->fileCollectionItemRepository->getCollectionIdsByFileIds(
            $fileIdsInt,
            $userId,
            $organizationCode,
            $fileCount
        );

        if (empty($collectionIds)) {
            return [];
        }

        // 提取文件集ID
        $matchedCollectionIds = [];
        foreach ($collectionIds as $row) {
            $collectionId = (int) ($row['collection_id'] ?? 0);
            if ($collectionId > 0) {
                $matchedCollectionIds[] = $collectionId;
            }
        }

        if (empty($matchedCollectionIds)) {
            return [];
        }

        // 批量查找所有匹配文件集的分享记录
        $resourceIds = array_map(fn ($id) => (string) $id, $matchedCollectionIds);
        $shareEntities = $this->shareRepository->getSharesByResourceIds($resourceIds);

        // 支持的资源类型：FileCollection(13) 和 File(15)
        $allowedResourceTypes = [
            ResourceType::FileCollection->value,
            ResourceType::File->value,
        ];

        // 过滤：只返回当前用户的、同组织的、正确资源类型的、有效的分享
        foreach ($shareEntities as $shareEntity) {
            // 确保是当前用户的分享
            if ($shareEntity->getCreatedUid() !== $userId) {
                continue;
            }
            // 确保是当前组织的分享（防止跨组织越权）
            if ($shareEntity->getOrganizationCode() !== $organizationCode) {
                continue;
            }
            // 过滤资源类型：只支持文件集(13)和单文件(15)
            if (! in_array($shareEntity->getResourceType(), $allowedResourceTypes, true)) {
                continue;
            }
            // 确保是有效的分享（未删除且未过期）
            if (! $shareEntity->isValid()) {
                continue;
            }
            $validShareEntities[] = $shareEntity;
        }

        return $validShareEntities;
    }

    /**
     * 根据项目ID查找项目分享.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param string $projectId 项目ID
     * @return array ResourceShareEntity[] 分享实体数组
     * @throws InvalidArgumentException 当参数无效时
     */
    public function findSharesByProjectId(
        string $userId,
        string $organizationCode,
        string $projectId
    ): array {
        if (empty($projectId)) {
            return [];
        }

        $userId = trim((string) $userId);
        $organizationCode = trim((string) $organizationCode);

        if (empty($userId) || empty($organizationCode)) {
            throw new InvalidArgumentException('用户ID或组织代码不能为空');
        }

        $shareEntities = $this->shareRepository->getSharesByProjectId($projectId);

        if (empty($shareEntities)) {
            return [];
        }

        // 过滤：只返回当前用户的、同组织的、有效的分享
        $validShareEntities = [];
        foreach ($shareEntities as $shareEntity) {
            if ($shareEntity->getCreatedUid() !== $userId) {
                continue;
            }
            if ($shareEntity->getOrganizationCode() !== $organizationCode) {
                continue;
            }
            if (! $shareEntity->isValid()) {
                continue;
            }
            $validShareEntities[] = $shareEntity;
        }

        return $validShareEntities;
    }

    /**
     * 解析 target_ids 数组，提取用户ID和部门ID.
     *
     * @param array $targets target_ids 数组
     * @return array [用户ID数组, 部门ID数组]
     */
    public function parseTargetIds(array $targets): array
    {
        $targetUserIds = [];
        $targetDepartmentIds = [];

        foreach ($targets as $item) {
            $targetType = $item['target_type'] ?? '';
            $targetId = $item['target_id'] ?? '';

            if ($targetId === '') {
                continue;
            }

            if ($targetType === 'User') {
                $targetUserIds[] = (string) $targetId;
            } elseif ($targetType === 'Department') {
                $targetDepartmentIds[] = (string) $targetId;
            }
        }

        return [$targetUserIds, $targetDepartmentIds];
    }

    /**
     * 获取用户分享的项目ID列表（去重）.
     *
     * @param string $userId 用户ID
     * @param array $resourceTypes 资源类型数组
     * @return array 项目ID数组
     */
    public function getSharedProjectIdsByUser(string $userId, array $resourceTypes): array
    {
        return $this->shareRepository->getSharedProjectIdsByUser($userId, $resourceTypes);
    }

    /**
     * 计算项目文件数量映射.
     *
     * @param array $shareEntities 分享实体数组
     * @param ?int $resourceType 资源类型
     * @return array<int, int> 项目ID => 文件数量的映射
     */
    public function calculateProjectFileCounts(array $shareEntities, ?int $resourceType): array
    {
        if ($resourceType !== ResourceType::Project->value) {
            return [];
        }

        $projectIds = [];
        foreach ($shareEntities as $shareEntity) {
            if ($shareEntity->getResourceType() === ResourceType::Project->value) {
                $projectId = $shareEntity->getProjectId();
                if (! empty($projectId)) {
                    $projectIds[] = (int) $projectId;
                }
            }
        }

        if (empty($projectIds)) {
            return [];
        }

        return $this->taskFileRepository->countFilesByProjectIds(array_unique($projectIds));
    }

    /**
     * 获取分享项的文件ID列表.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param SimilarQueryCondition $condition 查询条件
     * @return array<string> 文件ID数组
     */
    public function getFileIdsForShareItem(ResourceShareEntity $shareEntity, SimilarQueryCondition $condition): array
    {
        $entityResourceType = $shareEntity->getResourceType();

        // FileCollection 和 File 类型：从文件集中获取
        if (in_array(
            $entityResourceType,
            [ResourceType::FileCollection->value, ResourceType::File->value],
            true
        )) {
            $collectionId = (int) $shareEntity->getResourceId();
            $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
            return array_map(fn ($item) => (string) $item->getFileId(), $fileCollectionItems);
        }

        // 项目类型：返回查询条件中的 file_ids
        if ($condition->getResourceType() === ResourceType::Project->value) {
            return array_map(fn ($id) => (string) $id, $condition->getFileIds());
        }

        // 其他类型：返回空数组
        return [];
    }

    /**
     * 为分享列表项批量解析 file_ids（与 list 下标一一对应）.
     *
     * 仅对 resource_type=13(FileCollection) 和 15(File) 返回 file_ids，
     * resource_type=12(Project) 或其他类型返回空数组，避免响应过大。
     *
     * @param array<int, array> $list 当前页 list，每项含 resource_type, resource_id
     * @return array<int, array<string>> 下标 => file_ids（string数组）
     */
    public function getFileIdsForShareListItems(array $list): array
    {
        if (empty($list)) {
            return [];
        }

        $result = [];
        $fileIdsByResourceId = [];
        $collectionIds = [];

        foreach ($list as $index => $item) {
            $rt = $item['resource_type'] ?? 0;

            if (! in_array($rt, [ResourceType::FileCollection->value, ResourceType::File->value], true)) {
                $result[$index] = [];
                continue;
            }

            $rid = $item['resource_id'] ?? '';
            if ($rid !== '' && is_numeric($rid)) {
                $collectionIds[(int) $rid] = true;
            }
        }

        // 批量查询文件集
        foreach (array_keys($collectionIds) as $cid) {
            $items = $this->fileCollectionDomainService->getFilesByCollectionId($cid);
            $fileIdsByResourceId[(string) $cid] = array_map(fn ($i) => (string) $i->getFileId(), $items);
        }

        foreach ($list as $index => $item) {
            if (isset($result[$index])) {
                continue;
            }
            $rid = $item['resource_id'] ?? '';
            $result[$index] = $fileIdsByResourceId[(string) $rid] ?? [];
        }

        return $result;
    }

    /**
     * 根据文件ID数组批量获取文件详情.
     *
     * @param array $fileIds 文件ID数组（字符串数组）
     * @return TaskFileEntity[] 文件实体数组
     */
    public function getFilesByIds(array $fileIds): array
    {
        if (empty($fileIds)) {
            return [];
        }

        // 将字符串ID转为整数数组供Repository使用
        $intFileIds = array_map('intval', $fileIds);

        // 调用Repository批量查询（projectId传0表示不限制项目）
        return $this->taskFileRepository->getFilesByIds($intFileIds, 0);
    }
}
