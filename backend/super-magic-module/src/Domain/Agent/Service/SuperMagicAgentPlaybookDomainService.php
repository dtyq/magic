<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Hyperf\DbConnection\Annotation\Transactional;

/**
 * Agent Playbook Domain Service.
 */
class SuperMagicAgentPlaybookDomainService
{
    public function __construct(
        protected readonly AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected readonly SuperMagicAgentRepositoryInterface $superMagicAgentRepository
    ) {
    }

    /**
     * 批量根据 agent_code 列表查询 Playbook 列表.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param array<string> $agentCodes Agent Code 列表
     * @return array<string, array<int, AgentPlaybookEntity>> 按 agent_code 分组的 Playbook 实体数组
     */
    public function getByAgentCodesForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, array $agentCodes, ?bool $isEnabled = null): array
    {
        return $this->agentPlaybookRepository->getByAgentCodesForCurrentVersion($dataIsolation, $agentCodes, $isEnabled);
    }

    /**
     * 根据 agent_code 查询当前版本的 Playbook 列表.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param null|bool $isEnabled 是否只查询激活的 Playbook：true=仅返回已激活, false=仅返回未激活, null=返回全部
     * @return AgentPlaybookEntity[] Playbook 实体数组
     */
    public function getByAgentCodeForCurrentVersion(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, ?bool $isEnabled = null): array
    {
        return $this->agentPlaybookRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode, $isEnabled);
    }

    /**
     * @return AgentPlaybookEntity[]
     */
    public function getByAgentVersionId(SuperMagicAgentDataIsolation $dataIsolation, int $agentVersionId, ?bool $isEnabled = null): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionId($dataIsolation, $agentVersionId, $isEnabled);
    }

    /**
     * 创建 Playbook.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param AgentPlaybookEntity $entity Playbook 实体
     * @return AgentPlaybookEntity 创建后的 Playbook 实体
     */
    #[Transactional]
    public function createPlaybook(SuperMagicAgentDataIsolation $dataIsolation, AgentPlaybookEntity $entity): AgentPlaybookEntity
    {
        // 设置创建者
        $entity->setCreatorId($dataIsolation->getCurrentUserId());
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());

        // 设置创建时间
        $entity->setCreatedAt(date('Y-m-d H:i:s'));
        $entity->setUpdatedAt(date('Y-m-d H:i:s'));

        $result = $this->agentPlaybookRepository->save($dataIsolation, $entity);

        // 更新 Agent 的 updated_at 时间
        $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $entity->getAgentCode(), $dataIsolation->getCurrentUserId());

        return $result;
    }

    /**
     * 根据 playbook_id 查询 Playbook.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @return AgentPlaybookEntity Playbook 实体
     */
    public function getPlaybookById(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): AgentPlaybookEntity
    {
        $playbook = $this->agentPlaybookRepository->findById($dataIsolation, $playbookId);
        if (! $playbook) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $playbookId]);
        }

        return $playbook;
    }

    /**
     * 更新 Playbook（部分更新）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @param AgentPlaybookEntity $updateEntity 要更新的实体，只设置需要更新的字段（null 表示不更新）
     * @return AgentPlaybookEntity 更新后的 Playbook 实体
     */
    #[Transactional]
    public function updatePlaybook(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId, AgentPlaybookEntity $updateEntity): AgentPlaybookEntity
    {
        // 获取现有实体
        $existingEntity = $this->getPlaybookById($dataIsolation, $playbookId);

        // 设置 ID 和组织信息（确保更新的是正确的记录）
        $updateEntity->setId($playbookId);
        $updateEntity->setOrganizationCode($existingEntity->getOrganizationCode());
        $updateEntity->setAgentId($existingEntity->getAgentId());
        $updateEntity->setAgentCode($existingEntity->getAgentCode());
        $updateEntity->setCreatorId($existingEntity->getCreatorId());

        // 设置更新时间
        $updateEntity->setUpdatedAt(date('Y-m-d H:i:s'));

        $result = $this->agentPlaybookRepository->save($dataIsolation, $updateEntity);

        // 更新 Agent 的 updated_at 时间
        $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $existingEntity->getAgentCode(), $dataIsolation->getCurrentUserId());

        return $result;
    }

    /**
     * 删除 Playbook（软删除）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param int $playbookId Playbook ID
     * @return bool 是否删除成功
     */
    #[Transactional]
    public function deletePlaybook(SuperMagicAgentDataIsolation $dataIsolation, int $playbookId): bool
    {
        // 校验 Playbook 存在
        $playbook = $this->getPlaybookById($dataIsolation, $playbookId);
        $agentCode = $playbook->getAgentCode();

        $result = $this->agentPlaybookRepository->deleteById($dataIsolation, $playbookId);

        // 更新 Agent 的 updated_at 时间
        if ($result) {
            $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $agentCode, $dataIsolation->getCurrentUserId());
        }

        return $result;
    }

    /**
     * 批量重排序 Playbook.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentCode Agent Code
     * @param string[] $playbookIds Playbook ID 列表，按新顺序排列
     * @return int 更新的记录数
     */
    #[Transactional]
    public function reorderPlaybooks(SuperMagicAgentDataIsolation $dataIsolation, string $agentCode, array $playbookIds): int
    {
        if (empty($playbookIds)) {
            return 0;
        }

        // 1. 查询当前版本的所有 Playbook，获取 ID 列表用于校验
        $existingPlaybooks = $this->agentPlaybookRepository->getByAgentCodeForCurrentVersion($dataIsolation, $agentCode);
        $existingIds = array_map(fn ($playbook) => (string) $playbook->getId(), $existingPlaybooks);

        // 2. 分离有效的和无效的 Playbook ID，无效的排到最后面
        $validIds = array_intersect($playbookIds, $existingIds);
        $invalidIds = array_diff($playbookIds, $existingIds);
        $orderedPlaybookIds = array_merge($validIds, $invalidIds);

        // 3. 计算每个 Playbook 的 sort_order 并循环更新
        // 第一个 Playbook（索引 0）：sort_order = (列表长度 - 1) * 10
        // 第二个 Playbook（索引 1）：sort_order = (列表长度 - 2) * 10
        // 以此类推
        $listLength = count($orderedPlaybookIds);
        $updatedCount = 0;

        foreach ($orderedPlaybookIds as $index => $playbookId) {
            $sortOrder = ($listLength - 1 - $index) * 10;
            if ($this->agentPlaybookRepository->updateSortOrder($dataIsolation, (int) $playbookId, $sortOrder)) {
                ++$updatedCount;
            }
        }

        // 更新 Agent 的 updated_at 时间
        if ($updatedCount > 0) {
            $this->superMagicAgentRepository->updateUpdatedAtByCode($dataIsolation, $agentCode, $dataIsolation->getCurrentUserId());
        }

        return $updatedCount;
    }

    /**
     * @param mixed $agentVersionIds
     * @return array<int, array<AgentPlaybookEntity>>
     */
    public function getByAgentVersionIds($agentVersionIds): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionIds($agentVersionIds);
    }
}
