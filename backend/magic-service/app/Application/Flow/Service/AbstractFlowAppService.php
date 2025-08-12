<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\KnowledgeBase\Service\Strategy\KnowledgeBase\KnowledgeBaseStrategyInterface;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Agent\Service\MagicAgentVersionDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Type;
use App\Domain\Flow\Service\MagicFlowAIModelDomainService;
use App\Domain\Flow\Service\MagicFlowApiKeyDomainService;
use App\Domain\Flow\Service\MagicFlowDomainService;
use App\Domain\Flow\Service\MagicFlowDraftDomainService;
use App\Domain\Flow\Service\MagicFlowExecuteLogDomainService;
use App\Domain\Flow\Service\MagicFlowPermissionDomainService;
use App\Domain\Flow\Service\MagicFlowToolSetDomainService;
use App\Domain\Flow\Service\MagicFlowTriggerTestcaseDomainService;
use App\Domain\Flow\Service\MagicFlowVersionDomainService;
use App\Domain\Flow\Service\MagicFlowWaitMessageDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDocumentDomainService;
use App\Domain\KnowledgeBase\Service\KnowledgeBaseDomainService;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

abstract class AbstractFlowAppService extends AbstractKernelAppService
{
    public function __construct(
        protected readonly MagicFlowAIModelDomainService $magicFlowAIModelDomainService,
        protected readonly MagicFlowDomainService $magicFlowDomainService,
        protected readonly FileDomainService $fileDomainService,
        protected readonly MagicUserDomainService $magicUserDomainService,
        protected readonly OperationPermissionAppService $operationPermissionAppService,
        protected readonly MagicFlowToolSetDomainService $magicFlowToolSetDomainService,
        protected readonly MagicFlowDraftDomainService $magicFlowDraftDomainService,
        protected readonly MagicFlowApiKeyDomainService $magicFlowApiKeyDomainService,
        protected readonly MagicAgentDomainService $magicAgentDomainService,
        protected readonly MagicAgentVersionDomainService $magicAgentVersionDomainService,
        protected readonly MagicFlowPermissionDomainService $magicFlowPermissionDomainService,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicChatFileDomainService $magicChatFileDomainService,
        protected readonly KnowledgeBaseDomainService $magicFlowKnowledgeDomainService,
        protected readonly MagicFlowTriggerTestcaseDomainService $magicFlowTriggerTestcaseDomainService,
        protected readonly MagicFlowVersionDomainService $magicFlowVersionDomainService,
        protected readonly MagicFlowWaitMessageDomainService $magicFlowWaitMessageDomainService,
        protected readonly MagicOrganizationEnvDomainService $magicEnvironmentDomainService,
        protected readonly MagicFlowExecuteLogDomainService $magicFlowExecuteLogDomainService,
        protected readonly MagicAccountDomainService $magicAccountDomainService,
        protected readonly AdminProviderDomainService $serviceProviderDomainService,
        protected readonly KnowledgeBaseDocumentDomainService $magicFlowDocumentDomainService,
        protected readonly KnowledgeBaseStrategyInterface $knowledgeBaseStrategy,
    ) {
    }

    protected function createContactDataIsolation(FlowDataIsolation $dataIsolation): ContactDataIsolation
    {
        return ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
    }

    protected function getFlowAndValidateOperation(FlowDataIsolation $dataIsolation, string $flowCode, string $checkOperation): MagicFlowEntity
    {
        if (empty($flowCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow_code']);
        }
        $magicFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $flowCode);
        if (! $magicFlow) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => $flowCode]);
        }
        $operation = $this->getFlowOperation($dataIsolation, $magicFlow);
        $operation->validate($checkOperation, $magicFlow->getCode());
        $magicFlow->setUserOperation($operation->value);

        return $magicFlow;
    }

    protected function getFlowOperation(FlowDataIsolation $dataIsolation, MagicFlowEntity $flowEntity): Operation
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        return match ($flowEntity->getType()) {
            Type::Main => $this->getOperationByMain($permissionDataIsolation, $flowEntity),
            Type::Sub => $this->operationPermissionAppService->getOperationByResourceAndUser(
                $permissionDataIsolation,
                ResourceType::SubFlowCode,
                $flowEntity->getCode(),
                $dataIsolation->getCurrentUserId()
            ),
            Type::Tools => $this->operationPermissionAppService->getOperationByResourceAndUser(
                $permissionDataIsolation,
                ResourceType::ToolSet,
                $flowEntity->getToolSetId(),
                $dataIsolation->getCurrentUserId()
            ),
            default => Operation::None,
        };
    }

    protected function getKnowledgeOperation(FlowDataIsolation $dataIsolation, int|string $knowledgeCode): Operation
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);

        if (empty($knowledgeCode)) {
            return Operation::None;
        }
        return $this->operationPermissionAppService->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::Knowledge,
            (string) $knowledgeCode,
            $permissionDataIsolation->getCurrentUserId()
        );
    }

    private function getOperationByMain(PermissionDataIsolation $dataIsolation, MagicFlowEntity $flowEntity): Operation
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        if (! $agentId = $flowEntity->getAgentId()) {
            $agentId = $this->magicAgentDomainService->getByFlowCode($flowEntity->getCode())->getId();
        }
        return $this->operationPermissionAppService->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::AgentCode,
            $agentId,
            $dataIsolation->getCurrentUserId()
        );
    }
}
