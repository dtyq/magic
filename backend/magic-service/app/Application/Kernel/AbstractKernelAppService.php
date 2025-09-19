<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Kernel;

use App\Application\Flow\ExecuteManager\ExecutionData\Operator;
use App\Application\Permission\Service\OperationPermissionAppService;
use App\Domain\Admin\Entity\ValueObject\AdminDataIsolation;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Authentication\Entity\ValueObject\AuthenticationDataIsolation;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeBaseDataIsolation;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Collector\BuiltInToolSet\BuiltInToolSetCollector;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\DataIsolation\HandleDataIsolationInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Qbhy\HyperfAuth\Authenticatable;

abstract class AbstractKernelAppService
{
    /**
     * @return array<string,MagicUserEntity>
     */
    public function getUsers(string $organizationCode, array $userIds): array
    {
        $userIds = array_values(array_unique($userIds));
        return di(MagicUserDomainService::class)->getByUserIds(
            ContactDataIsolation::simpleMake($organizationCode),
            $userIds
        );
    }

    /**
     * @return array<string,FileLink>
     */
    public function getIcons(string $organizationCode, array $icons): array
    {
        $icons = array_values(array_unique($icons));
        return $this->getFileLinks($organizationCode, $icons);
    }

    /**
     * @return array<string,FileLink>
     */
    public function getFileLinks(string $organizationCode, array $fileLinks): array
    {
        $fileLinks = array_filter($fileLinks);
        return di(FileDomainService::class)->getLinks($organizationCode, $fileLinks);
    }

    public function getFileLink(string $organizationCode, string $icon): ?FileLink
    {
        return di(FileDomainService::class)->getLink($organizationCode, $icon);
    }

    public function createProviderDataIsolation(Authenticatable|BaseDataIsolation $authorization): ProviderDataIsolation
    {
        $dataIsolation = new ProviderDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createExecutionOperator(Authenticatable|BaseDataIsolation $authorization): Operator
    {
        $flowDataIsolation = $this->createFlowDataIsolation($authorization);

        $operator = new Operator();
        $operator->setUid($flowDataIsolation->getCurrentUserId());
        $operator->setOrganizationCode($flowDataIsolation->getCurrentOrganizationCode());

        if ($authorization instanceof MagicUserAuthorization) {
            $operator->setUid($authorization->getId());
            $operator->setOrganizationCode($authorization->getOrganizationCode());
            $operator->setNickname($authorization->getNickname());
            $operator->setRealName($authorization->getRealName());
            $operator->setAvatar($authorization->getAvatar());
            $operator->setMagicId($authorization->getMagicId());
        }
        if (! $operator->hasUid()) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'flow.system.uid_not_found');
        }

        return $operator;
    }

    protected function createContactDataIsolationByBase(BaseDataIsolation $dataIsolation): ContactDataIsolation
    {
        return ContactDataIsolation::create($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId());
    }

    protected function createAuthenticationDataIsolation(Authenticatable|BaseDataIsolation $authorization): AuthenticationDataIsolation
    {
        $dataIsolation = new AuthenticationDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createFlowDataIsolation(Authenticatable|BaseDataIsolation $authorization): FlowDataIsolation
    {
        $dataIsolation = new FlowDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createKnowledgeBaseDataIsolation(Authenticatable|BaseDataIsolation $authorization): KnowledgeBaseDataIsolation
    {
        $dataIsolation = new KnowledgeBaseDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createAdminDataIsolation(Authenticatable|BaseDataIsolation $authorization): AdminDataIsolation
    {
        $dataIsolation = new AdminDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createAgentDataIsolation(Authenticatable|BaseDataIsolation $authorization): AgentDataIsolation
    {
        $dataIsolation = new AgentDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected static function createFlowDataIsolationStaticMethod(Authenticatable|BaseDataIsolation $authorization): FlowDataIsolation
    {
        $dataIsolation = new FlowDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        self::handleByAuthorizationStaticMethod($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createLLMDataIsolation(Authenticatable|BaseDataIsolation $authorization): LLMDataIsolation
    {
        $dataIsolation = new LLMDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createPermissionDataIsolation(Authenticatable|BaseDataIsolation $authorization): PermissionDataIsolation
    {
        $dataIsolation = new PermissionDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createMCPDataIsolation(Authenticatable|BaseDataIsolation $authorization): MCPDataIsolation
    {
        $dataIsolation = new MCPDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function createModeDataIsolation(Authenticatable|BaseDataIsolation $authorization): ModeDataIsolation
    {
        $dataIsolation = new ModeDataIsolation();
        if ($authorization instanceof BaseDataIsolation) {
            $dataIsolation->extends($authorization);
            return $dataIsolation;
        }
        $this->handleByAuthorization($authorization, $dataIsolation);
        return $dataIsolation;
    }

    protected function checkInternalWhite(Authenticatable $authorization, SuperPermissionEnum $permission): void
    {
        if ($authorization instanceof MagicUserAuthorization) {
            if (PermissionChecker::mobileHasPermission($authorization->getMobile(), $permission)) {
                return;
            }
        }
        ExceptionBuilder::throw(GenericErrorCode::AccessDenied);
    }

    protected function handleByAuthorization(Authenticatable $authorization, BaseDataIsolation $baseDataIsolation): void
    {
        $envId = 0;
        $handleDataIsolation = di(HandleDataIsolationInterface::class);
        $handleDataIsolation->handleByAuthorization($authorization, $baseDataIsolation, $envId);
        EnvManager::initDataIsolationEnv($baseDataIsolation, $envId);
    }

    protected function getMCPServerOperation(BaseDataIsolation $dataIsolation, int|string $code): Operation
    {
        if (empty($code)) {
            return Operation::None;
        }
        // 如果是官方组织下，mcp 的所有人都是管理权限
        if ($dataIsolation->isOfficialOrganization()) {
            return Operation::Admin;
        }
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        return di(OperationPermissionAppService::class)->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::MCPServer,
            (string) $code,
            $permissionDataIsolation->getCurrentUserId()
        );
    }

    protected function getToolSetOperation(BaseDataIsolation $dataIsolation, int|string $code): Operation
    {
        if (empty($code)) {
            return Operation::None;
        }
        if (BuiltInToolSetCollector::isBuiltInToolSet($code)) {
            return Operation::Read;
        }
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        return di(OperationPermissionAppService::class)->getOperationByResourceAndUser(
            $permissionDataIsolation,
            ResourceType::ToolSet,
            (string) $code,
            $permissionDataIsolation->getCurrentUserId()
        );
    }

    private static function handleByAuthorizationStaticMethod(Authenticatable $authorization, BaseDataIsolation $baseDataIsolation): void
    {
        $envId = 0;
        $handleDataIsolation = di(HandleDataIsolationInterface::class);
        $handleDataIsolation->handleByAuthorization($authorization, $baseDataIsolation, $envId);
        EnvManager::initDataIsolationEnv($baseDataIsolation, $envId);
    }
}
