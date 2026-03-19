<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Code;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentMarketRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentPlaybookRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;

/**
 * Agent Market 领域服务.
 */
class SuperMagicAgentMarketDomainService
{
    public function __construct(
        protected SuperMagicAgentRepositoryInterface $superMagicAgentRepository,
        protected AgentPlaybookRepositoryInterface $agentPlaybookRepository,
        protected AgentMarketRepositoryInterface $agentMarketRepository,
        protected AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }

    /**
     * 查询市场员工列表.
     *
     * @param AgentMarketQuery $query 查询条件
     * @param Page $page 分页对象
     * @return array{total: int, list: array<AgentMarketEntity>}
     */
    public function queries(AgentMarketQuery $query, Page $page): array
    {
        return $this->agentMarketRepository->queries($query, $page);
    }

    /**
     * 根据 version_code 列表查询用户已添加的 Agent（用于判断 is_added 和 need_upgrade）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $userId 用户ID
     * @param string[] $versionCodes version_code 列表
     * @return array<string, SuperMagicAgentEntity> Agent 实体数组，key 为 version_code
     */
    public function getUserAgentsByVersionCodes(SuperMagicAgentDataIsolation $dataIsolation, string $userId, array $versionCodes): array
    {
        return $this->superMagicAgentRepository->findByVersionCodes($dataIsolation, $userId, $versionCodes);
    }

    /**
     * 批量根据 agent_version_id 列表查询 Playbook 列表（用于商店员工列表）.
     *
     * @param int[] $agentVersionIds Agent 版本 ID 列表
     * @return array<int, AgentPlaybookEntity[]> 按 agent_version_id 分组的 Playbook 实体数组，key 为 agent_version_id
     */
    public function getPlaybooksByAgentVersionIds(array $agentVersionIds): array
    {
        return $this->agentPlaybookRepository->getByAgentVersionIds($agentVersionIds);
    }

    /**
     * 雇用市场员工（从市场添加到用户员工列表）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $agentMarketCode 市场员工 code
     * @return SuperMagicAgentEntity 创建的 Agent 实体
     */
    public function hireAgent(SuperMagicAgentDataIsolation $dataIsolation, string $agentMarketCode): SuperMagicAgentEntity
    {
        // 1. 查询市场员工信息（仅查询已发布的）
        $agentMarket = $this->agentMarketRepository->findByAgentCodeForHire($agentMarketCode);
        if (! $agentMarket) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'super_magic.agent.store_agent_not_found');
        }
        if ($agentMarket->getPublisherId() === $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.store_agent_already_added');
        }

        // 2. 查询 Agent 版本信息
        $agentVersion = $this->agentVersionRepository->findById($agentMarket->getAgentVersionId());
        if (! $agentVersion) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }

        // 3. 检查组织是否已添加该员工
        $existingAgent = $this->superMagicAgentRepository->getUserAgentByVersionCode($dataIsolation, $agentMarketCode);
        if ($existingAgent !== null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.agent.store_agent_already_added');
        }

        // 4. 从市场 name_i18n 提取 name（英文）
        $nameI18n = $agentMarket->getNameI18n();
        $name = $nameI18n[LanguageEnum::EN_US->value] ?? ($nameI18n[LanguageEnum::ZH_CN->value] ?? '');

        // 5. 创建 Agent 实体
        $entity = new SuperMagicAgentEntity();
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setCode(Code::SuperMagicAgent->gen());
        $entity->setName($name);
        $entity->setDescription($agentVersion->getDescription());
        $entity->setIcon($agentMarket->getIcon());
        $entity->setIconType($agentVersion->getIconType());
        $entity->setType($agentVersion->getType());
        $entity->setEnabled($agentVersion->getEnabled());
        $entity->setPrompt($agentVersion->getPrompt() ?? []);
        $entity->setTools($agentVersion->getTools() ?? []);
        $entity->setCreator($dataIsolation->getCurrentUserId());
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->setNameI18n($agentMarket->getNameI18n() ?? []);
        $entity->setRoleI18n($agentMarket->getRoleI18n());
        $entity->setDescriptionI18n($agentMarket->getDescriptionI18n());
        $entity->setSourceType(AgentSourceType::MARKET);
        $entity->setSourceId($agentMarket->getId());
        $entity->setVersionId($agentMarket->getAgentVersionId());
        $entity->setVersionCode($agentMarket->getAgentCode());
        $entity->setFileKey($agentVersion->getFileKey());
        $entity->setLatestPublishedAt($agentVersion->getPublishedAt());

        // 7. 保存 Agent 记录
        $savedEntity = $this->superMagicAgentRepository->save($dataIsolation, $entity);

        // 8. 更新市场员工的安装次数
        $this->agentMarketRepository->incrementInstallCount($agentMarket->getId());

        return $savedEntity;
    }
}
