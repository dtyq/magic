<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Factory\Facade;

use Dtyq\SuperMagic\Application\Share\DTO\ShareableResourceDTO;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use RuntimeException;

/**
 * 资源工厂接口
 * 用于创建可共享资源对象的工厂接口.
 */
interface ResourceFactoryInterface
{
    /**
     * 获取该工厂支持的业务资源类型名称.
     */
    public function getResourceName(string $resourceId): string;

    /**
     * 扩展话题分享列表的数据.
     */
    public function getResourceExtendList(array $list): array;

    /**
     * 获取业务资源内容.
     */
    public function getResourceContent(string $resourceId, string $userId, string $organizationCode, int $page, int $pageSize): array;

    /**
     * 根据资源ID创建一个可共享资源对象
     *
     * @param string $resourceId 资源ID
     * @param string $userId 用户id
     * @param string $organizationCode 组织代码
     * @return ShareableResourceDTO 可共享资源对象
     * @throws RuntimeException 当资源不存在或无法创建共享资源时抛出异常
     */
    public function createResource(string $resourceId, string $userId, string $organizationCode): ShareableResourceDTO;

    /**
     * 检查资源是否存在且可以被共享.
     *
     * @param string $resourceId 资源ID
     * @param string $organizationCode 组织代码
     * @return bool 资源是否存在且可共享
     */
    public function isResourceShareable(string $resourceId, string $organizationCode): bool;

    /**
     * 检查用户是否有权限共享该资源.
     *
     * @param string $resourceId 资源ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return bool 是否有共享权限
     */
    public function hasSharePermission(string $resourceId, string $userId, string $organizationCode): bool;

    /**
     * 检查用户是否有权限管理（取消）该资源的分享.
     *
     * @param string $shareCreatorId 分享创建者ID
     * @param string $userId 当前用户ID
     * @param string $resourceId 资源ID
     * @param string $organizationCode 组织代码
     * @return bool 是否有管理分享的权限
     */
    public function hasManageSharePermission(string $shareCreatorId, string $userId, string $resourceId, string $organizationCode): bool;

    /**
     * 获取用于详情接口显示的资源名称.
     *
     * 此方法专门用于分享详情接口，与 getResourceName() 的区别：
     * - getResourceName(): 用于创建分享时获取并存储资源名称
     * - getResourceNameForDetail(): 用于详情接口动态获取显示名称
     *
     * @param ResourceShareEntity $shareEntity 分享实体，包含资源ID、项目ID等信息
     * @return string 显示名称
     */
    public function getResourceNameForDetail(ResourceShareEntity $shareEntity): string;
}
