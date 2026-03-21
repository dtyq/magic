<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentCategoryDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentMarketDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * Agent Market 应用服务.
 */
class SuperMagicAgentMarketAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentCategoryDomainService $superMagicAgentCategoryDomainService;

    #[Inject]
    protected SuperMagicAgentMarketDomainService $superMagicAgentMarketDomainService;

    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    /**
     * 获取分类列表（包含每个分类下的员工数量统计）.
     */
    /**
     * @return array<int, array{id:int, name_i18n:array, logo:?string, sort_order:int, crew_count:int}>
     */
    public function getCategories(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $categories = $this->superMagicAgentCategoryDomainService->getCategoriesWithCrewCount($dataIsolation);
        $this->updateCategoryLogoUrls($dataIsolation, $categories);

        $list = [];
        foreach ($categories as $category) {
            $list[] = [
                'id' => $category['id'],
                'name_i18n' => $category['name_i18n'],
                'logo' => ($category['logo'] ?? null) ?: null,
                'sort_order' => $category['sort_order'],
                'crew_count' => $category['crew_count'],
            ];
        }

        return $list;
    }

    /**
     * 查询员工市场列表.
     *
     * @return array{
     *     agent_markets: array<int, AgentMarketEntity>,
     *     user_agents_map: array<string, UserAgentEntity>,
     *     latest_versions_map: array<string, AgentVersionEntity>,
     *     playbooks_map: array<int, array<int, AgentPlaybookEntity>>,
     *     page: int,
     *     page_size: int,
     *     total: int
     * }
     */
    public function queries(Authenticatable $authorization, QueryAgentMarketsRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 获取用户语言偏好，默认 en_US
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        // 2. 创建查询对象
        $query = new AgentMarketQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($languageCode);
        if ($requestDTO->getCategoryId()) {
            $query->setCategoryId((int) $requestDTO->getCategoryId());
        }

        // 3. 创建分页对象
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        // 4. 查询市场员工列表
        $result = $this->superMagicAgentMarketDomainService->queries($query, $page);
        $agentMarkets = $result['list'];
        $total = $result['total'];

        if (empty($agentMarkets)) {
            return [
                'agent_markets' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'playbooks_map' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => $total,
            ];
        }

        // 5. 查询当前用户已添加的员工（用于判断 is_added）
        $agentCodes = array_map(fn ($agentMarket) => $agentMarket->getAgentCode(), $agentMarkets);
        $userAgentsMap = $this->superMagicAgentMarketDomainService->getUserAgentsByAgentCodes(
            $dataIsolation,
            $agentCodes
        );
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes($dataIsolation, $agentCodes);

        // 6. 批量查询 Playbook 列表
        $agentVersionIds = array_map(fn ($agentMarket) => $agentMarket->getAgentVersionId(), $agentMarkets);
        $playbooksMap = $this->superMagicAgentMarketDomainService->getPlaybooksByAgentVersionIds($agentVersionIds);

        return [
            'agent_markets' => $agentMarkets,
            'user_agents_map' => $userAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'playbooks_map' => $playbooksMap,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $total,
        ];
    }
}
