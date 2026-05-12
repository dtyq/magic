<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Collaboration;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use Dtyq\SuperMagic\Application\Collaboration\Contract\CollaborativeResourceAdapterInterface;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use InvalidArgumentException;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * Skill 资源协作适配器。
 *
 * 负责向共享协作内核提供 Skill 资源的读取和类型映射能力。
 */
class SkillResourceAdapter extends AbstractKernelAppService implements CollaborativeResourceAdapterInterface
{
    /**
     * 注入 Skill 资源读取所需依赖。
     */
    public function __construct(
        private readonly SkillDomainService $skillDomainService,
    ) {
    }

    /**
     * 根据 code 读取 Skill 资源实体。
     */
    public function getResource(Authenticatable $authorization, string $code): object
    {
        return $this->loadSkill($authorization, $code);
    }

    /**
     * 提取 Skill 绑定的项目 ID，供协作双写使用。
     */
    public function getProjectId(object $resource): int
    {
        return $this->assertSkillEntity($resource)->getProjectId() ?? 0;
    }

    /**
     * 获取 Skill 创建者，作为所有者保护依据。
     */
    public function getOwnerId(object $resource): string
    {
        return $this->assertSkillEntity($resource)->getCreatorId();
    }

    /**
     * 返回 Skill 在 operation_permissions 中对应的资源类型。
     */
    public function getOperationResourceType(): OperationResourceType
    {
        return OperationResourceType::Skill;
    }

    /**
     * 返回 Skill 在 resource_visibility 中对应的资源类型。
     */
    public function getVisibilityResourceType(): ResourceVisibilityResourceType
    {
        return ResourceVisibilityResourceType::SKILL;
    }

    /**
     * 创建 Skill 领域使用的数据隔离对象。
     */
    private function createSkillDataIsolation(Authenticatable $authorization): SkillDataIsolation
    {
        $dataIsolation = new SkillDataIsolation();
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    /**
     * 加载 Skill 实体，供存在性校验和上下文读取复用。
     */
    private function loadSkill(Authenticatable $authorization, string $code): SkillEntity
    {
        // 协作接口只负责拿到资源上下文，真正的权限判断统一由共享策略层负责。
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $dataIsolation->disabled();

        return $this->skillDomainService->findSkillByCode($dataIsolation, $code);
    }

    /**
     * 断言资源对象一定是 Skill 实体。
     */
    private function assertSkillEntity(object $resource): SkillEntity
    {
        if ($resource instanceof SkillEntity) {
            return $resource;
        }

        throw new InvalidArgumentException('resource must be SkillEntity');
    }
}
