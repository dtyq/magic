<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentPlaybookDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\CreatePlaybookRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\ReorderPlaybooksRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\UpdatePlaybookRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\PlaybookListItemDTO;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * Agent Playbook 应用服务.
 */
class SuperMagicAgentPlaybookAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentDomainService $superMagicAgentDomainService;

    #[Inject]
    protected SuperMagicAgentPlaybookDomainService $superMagicAgentPlaybookDomainService;

    /**
     * 创建员工 Playbook.
     */
    public function createPlaybook(Authenticatable $authorization, string $code, CreatePlaybookRequestDTO $requestDTO): AgentPlaybookEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 创建 Playbook Entity
        $entity = new AgentPlaybookEntity();
        $entity->setAgentId($agent->getId());
        $entity->setAgentCode($agent->getCode());
        $entity->setNameI18n($requestDTO->getNameI18n());
        $entity->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $entity->setThemeColor($requestDTO->getThemeColor());
        $entity->setIsEnabled($requestDTO->getEnabled());
        $entity->setSortOrder($requestDTO->getSortOrder());
        $entity->setConfig($requestDTO->getConfig());

        if ($requestDTO->getIcon()) {
            $entity->setIcon($requestDTO->getIcon());
        }

        // 3. 保存 Playbook
        return $this->superMagicAgentPlaybookDomainService->createPlaybook($dataIsolation, $entity);
    }

    /**
     * 更新员工 Playbook.
     */
    public function updatePlaybook(Authenticatable $authorization, string $code, int $playbookId, UpdatePlaybookRequestDTO $requestDTO): AgentPlaybookEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 校验 Playbook 归属该员工
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 3. 构建更新 Entity（只设置提供的字段，null 表示不更新）
        $updateEntity = new AgentPlaybookEntity();
        $updateEntity->setNameI18n($requestDTO->getNameI18n());
        $updateEntity->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $updateEntity->setIcon($requestDTO->getIcon());
        $updateEntity->setThemeColor($requestDTO->getThemeColor());
        $updateEntity->setIsEnabled($requestDTO->getEnabled());
        $updateEntity->setSortOrder($requestDTO->getSortOrder());
        $updateEntity->setConfig($requestDTO->getConfig());

        // 4. 更新 Playbook
        return $this->superMagicAgentPlaybookDomainService->updatePlaybook($dataIsolation, $playbookId, $updateEntity);
    }

    /**
     * 删除员工 Playbook.
     */
    public function deletePlaybook(Authenticatable $authorization, string $agentCode, int $playbookId): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $agentCode);

        // 2. 校验 Playbook 归属该员工
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 3. 删除 Playbook（软删除）
        $this->superMagicAgentPlaybookDomainService->deletePlaybook($dataIsolation, $playbookId);
    }

    /**
     * 切换员工 Playbook 启用/禁用状态.
     */
    public function togglePlaybookEnabled(Authenticatable $authorization, string $code, int $playbookId, bool $enabled): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $code);

        // 2. 校验 Playbook 归属该员工
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 3. 构建更新 Entity（只更新启用状态）
        $updateEntity = new AgentPlaybookEntity();
        $updateEntity->setIsEnabled($enabled);

        // 4. 更新 Playbook 启用状态
        $this->superMagicAgentPlaybookDomainService->updatePlaybook($dataIsolation, $playbookId, $updateEntity);
    }

    /**
     * 批量重排序员工 Playbook.
     */
    public function reorderPlaybooks(Authenticatable $authorization, string $agentCode, ReorderPlaybooksRequestDTO $requestDTO): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织和当前用户）
        $agent = $this->superMagicAgentDomainService->getByCodeWithUserCheck($dataIsolation, $agentCode);

        // 2. 批量重排序 Playbook
        $this->superMagicAgentPlaybookDomainService->reorderPlaybooks($dataIsolation, $agentCode, $requestDTO->getIds());
    }

    /**
     * 获取员工的场景列表.
     *
     * @return PlaybookListItemDTO[]
     */
    public function getAgentPlaybooks(Authenticatable $authorization, string $agentCode, ?bool $enabled = null): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询 Agent 记录（校验归属组织）
        $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 2. 查询 Playbook 列表
        $playbooks = $this->superMagicAgentPlaybookDomainService->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode, $enabled);

        // 3. 转换为 DTO
        $result = [];
        foreach ($playbooks as $playbook) {
            $result[] = new PlaybookListItemDTO(
                $playbook->getId() ?? 0,
                $playbook->getAgentId(),
                $playbook->getAgentCode(),
                $playbook->getNameI18n() ?? [],
                $playbook->getDescriptionI18n(),
                $playbook->getIcon(),
                $playbook->getThemeColor(),
                $playbook->getIsEnabled() ?? false,
                $playbook->getSortOrder() ?? 0,
                null,
                $playbook->getCreatedAt() ?? '',
                $playbook->getUpdatedAt() ?? ''
            );
        }

        return $result;
    }

    /**
     * 根据 ID 获取 Playbook 详情.
     */
    public function getPlaybookById(Authenticatable $authorization, int $playbookId): PlaybookListItemDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $dataIsolation->disabled();

        // 1. 查询 Playbook 详情
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);

        // 2. 转换为 DTO
        return new PlaybookListItemDTO(
            $playbook->getId() ?? 0,
            $playbook->getAgentId(),
            $playbook->getAgentCode(),
            $playbook->getNameI18n() ?? [],
            $playbook->getDescriptionI18n(),
            $playbook->getIcon(),
            $playbook->getThemeColor(),
            $playbook->getIsEnabled() ?? false,
            $playbook->getSortOrder() ?? 0,
            $playbook->getConfig(),
            $playbook->getCreatedAt() ?? '',
            $playbook->getUpdatedAt() ?? ''
        );
    }

    private function ensureAgentAccessible(SuperMagicAgentDataIsolation $dataIsolation, string $code): void
    {
        $accessibleCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
            [$code]
        );

        if (in_array($code, $accessibleCodes, true)) {
            return;
        }

        ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
    }
}
