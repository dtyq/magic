<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Command;

use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowQuery;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowToolSetDomainService;
use App\Domain\KnowledgeBase\Entity\ValueObject\Query\KnowledgeBaseQuery;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Psr\Container\ContainerInterface;

#[Command]
class InitOperationPermissionOwnerCommand extends HyperfCommand
{
    protected ContainerInterface $container;

    protected OperationPermissionDomainService $operationPermissionDomainService;

    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->operationPermissionDomainService = $container->get(OperationPermissionDomainService::class);

        parent::__construct('permission:init_operation_permission_owner');
    }

    public function handle(): void
    {
        $this->initAgent();
        $this->initSubFlow();
        $this->initToolSet();
        $this->initKnowledge();
    }

    private function initAgent(): void
    {
        $service = $this->container->get(MagicAgentDomainService::class);
        $resourceType = ResourceType::AgentCode;

        $query = new MagicAgentQuery();
        $data = $service->queries($query, Page::createNoPage());
        $list = $data['list'] ?? [];
        foreach ($list as $agent) {
            $resourceId = $agent->getId();
            $permissionDataIsolation = PermissionDataIsolation::create($agent->getOrganizationCode(), $agent->getCreatedUid());
            $this->operationPermissionDomainService->accessOwner($permissionDataIsolation, $resourceType, $resourceId, $agent->getCreatedUid());
            $this->output->info("Agent: {$resourceId}");
        }
    }

    private function initSubFlow(): void
    {
        $service = $this->container->get(MagicFlowDomainService::class);
        $flowDataIsolation = FlowDataIsolation::create();
        $resourceType = ResourceType::SubFlowCode;

        $query = new MagicFLowQuery();
        $query->setType(Type::Sub->value);
        $data = $service->queries($flowDataIsolation, $query, Page::createNoPage());
        $list = $data['list'] ?? [];
        foreach ($list as $flow) {
            $resourceId = $flow->getCode();
            $permissionDataIsolation = PermissionDataIsolation::create($flow->getOrganizationCode(), $flow->getCreator());
            $this->operationPermissionDomainService->accessOwner($permissionDataIsolation, $resourceType, $resourceId, $flow->getCreator());
            $this->output->info("SubFlow: {$resourceId}");
        }
    }

    private function initToolSet(): void
    {
        $service = $this->container->get(MagicFlowToolSetDomainService::class);
        $flowDataIsolation = FlowDataIsolation::create();
        $resourceType = ResourceType::ToolSet;

        $data = $service->queries($flowDataIsolation, new MagicFlowToolSetQuery(), Page::createNoPage());
        foreach ($data['list'] ?? [] as $toolSet) {
            $resourceId = $toolSet->getCode();
            $permissionDataIsolation = PermissionDataIsolation::create($toolSet->getOrganizationCode(), $toolSet->getCreator());
            $this->operationPermissionDomainService->accessOwner($permissionDataIsolation, $resourceType, $resourceId, $toolSet->getCreator());
            $this->output->info("ToolSet: {$resourceId}");
        }
    }

    private function initKnowledge(): void
    {
        $service = $this->container->get(KnowledgeBaseDomainService::class);
        $flowDataIsolation = FlowDataIsolation::create();
        $resourceType = ResourceType::Knowledge;

        $data = $service->queries($flowDataIsolation, new KnowledgeBaseQuery(), Page::createNoPage());
        foreach ($data['list'] ?? [] as $knowledge) {
            $resourceId = $knowledge->getCode();
            $permissionDataIsolation = PermissionDataIsolation::create($knowledge->getOrganizationCode(), $knowledge->getCreator());
            $this->operationPermissionDomainService->accessOwner($permissionDataIsolation, $resourceType, $resourceId, $knowledge->getCreator());
            $this->output->info("Knowledge: {$resourceId}");
        }
    }
}
