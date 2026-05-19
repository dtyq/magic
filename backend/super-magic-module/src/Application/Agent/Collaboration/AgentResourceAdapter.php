<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Collaboration;

use App\Application\Kernel\AbstractKernelAppService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use Dtyq\SuperMagic\Application\Collaboration\Contract\CollaborativeResourceAdapterInterface;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use InvalidArgumentException;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * Agent 资源协作适配器。
 *
 * 负责向共享协作内核提供 Agent 资源的读取和类型映射能力。
 */
class AgentResourceAdapter extends AbstractKernelAppService implements CollaborativeResourceAdapterInterface
{
    /**
     * 注入 Agent 资源读取所需依赖。
     */
    public function __construct(
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
    ) {
    }

    /**
     * 根据 code 读取 Agent 资源实体。
     */
    public function getResource(Authenticatable $authorization, string $code): object
    {
        return $this->loadAgent($authorization, $code);
    }

    /**
     * 提取 Agent 绑定的项目 ID，供协作双写使用。
     */
    public function getProjectId(object $resource): int
    {
        return $this->assertAgentEntity($resource)->getProjectId();
    }

    /**
     * 获取 Agent 创建者，作为所有者保护依据。
     */
    public function getOwnerId(object $resource): string
    {
        return $this->assertAgentEntity($resource)->getCreator();
    }

    /**
     * 返回 Agent 在 operation_permissions 中对应的资源类型。
     */
    public function getOperationResourceType(): OperationResourceType
    {
        return OperationResourceType::CustomAgent;
    }

    /**
     * 返回 Agent 在 resource_visibility 中对应的资源类型。
     */
    public function getVisibilityResourceType(): ResourceVisibilityResourceType
    {
        return ResourceVisibilityResourceType::SUPER_MAGIC_AGENT;
    }

    /**
     * 创建 Agent 领域使用的数据隔离对象。
     */
    private function createSuperMagicDataIsolation(Authenticatable $authorization): SuperMagicAgentDataIsolation
    {
        $dataIsolation = new SuperMagicAgentDataIsolation();
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    /**
     * 加载 Agent 实体，供存在性校验和上下文读取复用。
     */
    private function loadAgent(Authenticatable $authorization, string $code): SuperMagicAgentEntity
    {
        // 协作接口只负责拿到资源上下文，真正的权限判断统一由共享策略层负责。
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $dataIsolation->disabled();

        return $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $code);
    }

    /**
     * 断言资源对象一定是 Agent 实体。
     */
    private function assertAgentEntity(object $resource): SuperMagicAgentEntity
    {
        if ($resource instanceof SuperMagicAgentEntity) {
            return $resource;
        }

        throw new InvalidArgumentException('resource must be SuperMagicAgentEntity');
    }
}
