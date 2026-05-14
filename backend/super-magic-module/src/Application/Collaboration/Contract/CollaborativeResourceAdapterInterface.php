<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Collaboration\Contract;

use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use Qbhy\HyperfAuth\Authenticatable;

interface CollaborativeResourceAdapterInterface
{
    /**
     * 根据资源 code 取出真实资源实体。
     *
     * 该方法同时承担资源存在性校验，供共享协作服务统一获取上下文。
     */
    public function getResource(Authenticatable $authorization, string $code): object;

    /**
     * 协作双写时需要同步到项目成员表，因此这里暴露 project_id。
     */
    public function getProjectId(object $resource): int;

    /**
     * 用于保护 owner，避免协作者接口误改或误删创建者权限。
     */
    public function getOwnerId(object $resource): string;

    /**
     * 返回资源在协作权限表中的资源类型。
     */
    public function getOperationResourceType(): OperationResourceType;

    /**
     * 返回资源在可见性表中的资源类型。
     */
    public function getVisibilityResourceType(): ResourceVisibilityResourceType;
}
