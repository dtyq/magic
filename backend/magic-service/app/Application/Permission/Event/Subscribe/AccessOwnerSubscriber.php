<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Permission\Event\Subscribe;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Event\MagicAgentSavedEvent;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Event\MagicFLowSavedEvent;
use App\Domain\Flow\Event\MagicFLowToolSetSavedEvent;
use App\Domain\KnowledgeBase\Entity\KnowledgeBaseEntity;
use App\Domain\KnowledgeBase\Event\KnowledgeBaseSavedEvent;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Event\MCPServerSavedEvent;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Event\SuperMagicAgentSavedEvent;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Psr\Container\ContainerInterface;

#[Listener]
readonly class AccessOwnerSubscriber implements ListenerInterface
{
    private OperationPermissionDomainService $operationPermissionDomainService;

    public function __construct(private ContainerInterface $container)
    {
        $this->operationPermissionDomainService = $this->container->get(OperationPermissionDomainService::class);
    }

    public function listen(): array
    {
        return [
            MagicAgentSavedEvent::class,
            MagicFLowSavedEvent::class,
            MagicFLowToolSetSavedEvent::class,
            KnowledgeBaseSavedEvent::class,
            MCPServerSavedEvent::class,
            SuperMagicAgentSavedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if ($event instanceof MagicAgentSavedEvent) {
            $this->handleAgent($event->agentEntity, $event->create);
        }
        if ($event instanceof MagicFLowSavedEvent) {
            $this->handleFlow($event->flow, $event->create);
        }
        if ($event instanceof MagicFLowToolSetSavedEvent) {
            $this->handleToolSet($event->toolSetEntity, $event->create);
        }
        if ($event instanceof KnowledgeBaseSavedEvent) {
            $this->handleKnowledge($event->magicFlowKnowledgeEntity, $event->create);
        }
        if ($event instanceof MCPServerSavedEvent) {
            $this->handleMCPServer($event->MCPServerEntity, $event->create);
        }
        if ($event instanceof SuperMagicAgentSavedEvent) {
            $this->handleCustomAgent($event->superMagicAgentEntity, $event->create);
        }
    }

    private function handleAgent(MagicAgentEntity $agentEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($agentEntity->getOrganizationCode(), $agentEntity->getCreatedUid());
        if ($create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::AgentCode,
                $agentEntity->getId(),
                $agentEntity->getCreatedUid()
            );
        }
    }

    private function handleFlow(MagicFlowEntity $flowEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($flowEntity->getOrganizationCode(), $flowEntity->getCreator());
        if ($flowEntity->getType() === Type::Sub && $create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::SubFlowCode,
                $flowEntity->getCode(),
                $flowEntity->getCreator()
            );
        }
    }

    private function handleToolSet(MagicFlowToolSetEntity $toolSetEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($toolSetEntity->getOrganizationCode(), $toolSetEntity->getCreator());
        if ($create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::ToolSet,
                $toolSetEntity->getCode(),
                $toolSetEntity->getCreator()
            );
        }
    }

    private function handleKnowledge(KnowledgeBaseEntity $knowledgeEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($knowledgeEntity->getOrganizationCode(), $knowledgeEntity->getCreator());
        if ($create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::Knowledge,
                $knowledgeEntity->getCode(),
                $knowledgeEntity->getCreator()
            );
        }
    }

    private function handleMCPServer(MCPServerEntity $MCPServerEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($MCPServerEntity->getOrganizationCode(), $MCPServerEntity->getCreator());
        if ($create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::MCPServer,
                $MCPServerEntity->getCode(),
                $MCPServerEntity->getCreator()
            );
        }
    }

    private function handleCustomAgent(SuperMagicAgentEntity $superMagicAgentEntity, bool $create): void
    {
        $permissionDataIsolation = PermissionDataIsolation::create($superMagicAgentEntity->getOrganizationCode(), $superMagicAgentEntity->getCreator());
        if ($create) {
            $this->operationPermissionDomainService->accessOwner(
                $permissionDataIsolation,
                ResourceType::CustomAgent,
                $superMagicAgentEntity->getCode(),
                $superMagicAgentEntity->getCreator()
            );
        }
    }
}
