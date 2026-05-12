<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
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
 *
 * 所有写操作统一通过协作权限模型判定（editor 以上方可操作），
 * 读操作统一通过可读权限判定（viewer 及以上均可查看），
 * 不再依赖 creator_id 的 owner-only 校验逻辑。
 */
class SuperMagicAgentPlaybookAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentDomainService $superMagicAgentDomainService;

    #[Inject]
    protected SuperMagicAgentPlaybookDomainService $superMagicAgentPlaybookDomainService;

    /**
     * 创建员工 Playbook.
     *
     * 要求当前用户对所属 Agent 具备编辑权限（editor / admin / owner）。
     */
    public function createPlaybook(Authenticatable $authorization, string $agentCode, CreatePlaybookRequestDTO $requestDTO): AgentPlaybookEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 写操作：校验当前用户对 Agent 的编辑权限
        $this->assertAgentEditable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 构建 Playbook 实体
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

        return $this->superMagicAgentPlaybookDomainService->createPlaybook($dataIsolation, $entity);
    }

    /**
     * 更新员工 Playbook.
     *
     * 要求当前用户对所属 Agent 具备编辑权限（editor / admin / owner）。
     */
    public function updatePlaybook(Authenticatable $authorization, string $agentCode, int $playbookId, UpdatePlaybookRequestDTO $requestDTO): AgentPlaybookEntity
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 写操作：校验当前用户对 Agent 的编辑权限
        $this->assertAgentEditable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 校验 Playbook 归属于该 Agent
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 构建更新实体（仅设置提供的字段，null 表示不更新）
        $updateEntity = new AgentPlaybookEntity();
        $updateEntity->setNameI18n($requestDTO->getNameI18n());
        $updateEntity->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $updateEntity->setIcon($requestDTO->getIcon());
        $updateEntity->setThemeColor($requestDTO->getThemeColor());
        $updateEntity->setIsEnabled($requestDTO->getEnabled());
        $updateEntity->setSortOrder($requestDTO->getSortOrder());
        $updateEntity->setConfig($requestDTO->getConfig());

        return $this->superMagicAgentPlaybookDomainService->updatePlaybook($dataIsolation, $playbookId, $updateEntity);
    }

    /**
     * 删除员工 Playbook.
     *
     * 要求当前用户对所属 Agent 具备编辑权限（editor / admin / owner）。
     */
    public function deletePlaybook(Authenticatable $authorization, string $agentCode, int $playbookId): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 写操作：校验当前用户对 Agent 的编辑权限
        $this->assertAgentEditable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 校验 Playbook 归属于该 Agent
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 软删除 Playbook
        $this->superMagicAgentPlaybookDomainService->deletePlaybook($dataIsolation, $playbookId);
    }

    /**
     * 切换员工 Playbook 启用/禁用状态.
     *
     * 要求当前用户对所属 Agent 具备编辑权限（editor / admin / owner）。
     */
    public function togglePlaybookEnabled(Authenticatable $authorization, string $agentCode, int $playbookId, bool $enabled): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 写操作：校验当前用户对 Agent 的编辑权限
        $this->assertAgentEditable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();
        $agent = $this->superMagicAgentDomainService->getByCodeWithException($dataIsolation, $agentCode);

        // 校验 Playbook 归属于该 Agent
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);
        if ($playbook->getAgentId() !== $agent->getId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        // 构建仅更新启用状态的实体
        $updateEntity = new AgentPlaybookEntity();
        $updateEntity->setIsEnabled($enabled);

        $this->superMagicAgentPlaybookDomainService->updatePlaybook($dataIsolation, $playbookId, $updateEntity);
    }

    /**
     * 批量重排序员工 Playbook.
     *
     * 要求当前用户对所属 Agent 具备编辑权限（editor / admin / owner）。
     */
    public function reorderPlaybooks(Authenticatable $authorization, string $agentCode, ReorderPlaybooksRequestDTO $requestDTO): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 写操作：校验当前用户对 Agent 的编辑权限
        $this->assertAgentEditable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();

        $this->superMagicAgentPlaybookDomainService->reorderPlaybooks($dataIsolation, $agentCode, $requestDTO->getIds());
    }

    /**
     * 获取员工的 Playbook 列表.
     *
     * 要求当前用户对所属 Agent 具备读取权限（viewer / editor / admin / owner）。
     *
     * @return PlaybookListItemDTO[]
     */
    public function getAgentPlaybooks(Authenticatable $authorization, string $agentCode, ?bool $enabled = null): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 读操作：校验当前用户对 Agent 的读取权限（协作模型：viewer 及以上）
        $this->assertAgentReadable($dataIsolation, $agentCode);

        // 权限断言通过后，关闭组织过滤以读取协作者可能非本人创建的 Agent
        $dataIsolation->disabled();

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
     *
     * 先读取 Playbook 获取所属 Agent code，再校验当前用户对该 Agent 具备读取权限。
     */
    public function getPlaybookById(Authenticatable $authorization, int $playbookId): PlaybookListItemDTO
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 关闭组织过滤以直接按 ID 读取 Playbook（权限校验在后续步骤完成）
        $dataIsolation->disabled();
        $playbook = $this->superMagicAgentPlaybookDomainService->getPlaybookById($dataIsolation, $playbookId);

        // 读取 Playbook 所属 Agent code 后，校验当前用户对该 Agent 具备读取权限
        $this->assertAgentReadable($dataIsolation, $playbook->getAgentCode());

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
}
