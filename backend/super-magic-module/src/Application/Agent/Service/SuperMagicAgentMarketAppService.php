<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentCategoryDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentMarketDomainService;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\AgentMarketListItemDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\CategoryListItemDTO;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Response\QueryAgentMarketsResponseDTO;
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

    /**
     * 获取分类列表（包含每个分类下的员工数量统计）.
     */
    public function getCategories(Authenticatable $authorization): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 1. 查询分类列表（包含员工数量统计）
        $categories = $this->superMagicAgentCategoryDomainService->getCategoriesWithCrewCount($dataIsolation);

        // 2. 更新 Category Logo URL（将路径转换为完整URL）
        $this->updateCategoryLogoUrls($dataIsolation, $categories);

        // 3. 构建 DTO 列表
        $list = [];
        foreach ($categories as $category) {
            $logo = $category['logo'] ?? null;

            $list[] = new CategoryListItemDTO(
                id: $category['id'],
                nameI18n: $category['name_i18n'],
                logo: $logo ?: null,
                sortOrder: $category['sort_order'],
                crewCount: $category['crew_count']
            );
        }

        return $list;
    }

    /**
     * 查询员工市场列表.
     */
    public function queries(Authenticatable $authorization, QueryAgentMarketsRequestDTO $requestDTO): QueryAgentMarketsResponseDTO
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
            return new QueryAgentMarketsResponseDTO(
                list: [],
                page: $requestDTO->getPage(),
                pageSize: $requestDTO->getPageSize(),
                total: $total
            );
        }

        // 5. 查询当前用户已添加的员工（用于判断 is_added 和 need_upgrade）
        $agentCodes = array_map(fn ($agentMarket) => $agentMarket->getAgentCode(), $agentMarkets);
        $userAgentsMap = $this->superMagicAgentMarketDomainService->getUserAgentsByVersionCodes(
            $dataIsolation,
            $dataIsolation->getCurrentUserId(),
            $agentCodes
        );

        // 6. 批量查询 Playbook 列表
        $agentVersionIds = array_map(fn ($agentMarket) => $agentMarket->getAgentVersionId(), $agentMarkets);
        $playbooksMap = $this->superMagicAgentMarketDomainService->getPlaybooksByAgentVersionIds($agentVersionIds);

        // 8. 构建员工列表项并设置 is_added 和 need_upgrade
        $list = [];
        foreach ($agentMarkets as $agentMarket) {
            $agentCode = $agentMarket->getAgentCode();
            $userAgent = $userAgentsMap[$agentCode] ?? null;

            // 8.1 判断 is_added
            $isAdded = $userAgent !== null;

            // 8.2 判断 need_upgrade
            $needUpgrade = false;
            if ($isAdded && $userAgent !== null) {
                $userSourceType = $userAgent->getSourceType();
                if ($userSourceType->isMarket()) {
                    $userVersionId = $userAgent->getVersionId();
                    $agentMarketVersionId = $agentMarket->getAgentVersionId();
                    $needUpgrade = ($userVersionId !== null && $userVersionId !== $agentMarketVersionId);
                }
            }

            // 8.3 构建 Playbook 列表（features）
            $agentVersionId = $agentMarket->getAgentVersionId();
            $playbooks = $playbooksMap[$agentVersionId] ?? [];
            $features = [];
            foreach ($playbooks as $playbook) {
                $features[] = [
                    'name_i18n' => $playbook->getNameI18n() ?? [],
                    'icon' => $playbook->getIcon(),
                    'theme_color' => $playbook->getThemeColor(),
                ];
            }

            // 8.4 构建列表项 DTO
            $list[] = new AgentMarketListItemDTO(
                id: $agentMarket->getId() ?? 0,
                agentCode: $agentCode,
                userCode: $userAgent?->getCode() ?? null,
                nameI18n: $agentMarket->getNameI18n() ?? [],
                roleI18n: $agentMarket->getRoleI18n(),
                descriptionI18n: $agentMarket->getDescriptionI18n(),
                icon: $agentMarket->getIcon(),
                iconType: $agentMarket->getIconType()->value,
                playbooks: $features,
                publisherType: $agentMarket->getPublisherType()->value,
                categoryId: $agentMarket->getCategoryId(),
                isAdded: $isAdded,
                needUpgrade: $needUpgrade,
                createdAt: $agentMarket->getCreatedAt() ?? '',
                updatedAt: $agentMarket->getUpdatedAt() ?? ''
            );
        }

        return new QueryAgentMarketsResponseDTO(
            list: $list,
            page: $requestDTO->getPage(),
            pageSize: $requestDTO->getPageSize(),
            total: $total
        );
    }

    /**
     * 雇用市场员工（从市场添加到用户员工列表）.
     */
    public function hireAgent(Authenticatable $authorization, string $agentMarketCode): void
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        // 调用 DomainService 处理业务逻辑
        $this->superMagicAgentMarketDomainService->hireAgent($dataIsolation, $agentMarketCode);
    }
}
