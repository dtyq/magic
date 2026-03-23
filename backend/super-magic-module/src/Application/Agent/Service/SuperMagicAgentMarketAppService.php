<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\File\EasyFileTools;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentMarketEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentPlaybookEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\UserAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\AgentSourceType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentCategoryDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentMarketDomainService;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Interfaces\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;

/**
 * Application service for market agent use cases.
 */
class SuperMagicAgentMarketAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected SuperMagicAgentCategoryDomainService $superMagicAgentCategoryDomainService;

    #[Inject]
    protected SuperMagicAgentMarketDomainService $superMagicAgentMarketDomainService;

    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    /**
     * Return all categories with their published crew counts.
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
     * Return the detail view for a published market agent.
     *
     * @return array{
     *     agent_market: AgentMarketEntity,
     *     agent_version: AgentVersionEntity
     * }
     */
    public function show(Authenticatable $authorization, string $code): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $agentMarket = $this->superMagicAgentMarketDomainService->getPublishedByAgentCode($code);
        if ($agentMarket === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }

        $agentVersion = $this->superMagicAgentVersionDomainService->findByIdWithoutOrganizationFilter(
            $agentMarket->getAgentVersionId()
        );
        if ($agentVersion === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::AgentVersionNotFound, 'super_magic.agent.agent_version_not_found');
        }

        $this->updateAgentMarketIcon($dataIsolation, $agentMarket);

        return [
            'agent_market' => $agentMarket,
            'agent_version' => $agentVersion,
        ];
    }

    /**
     * Query the published market list.
     *
     * @return array{
     *     agent_markets: array<int, AgentMarketEntity>,
     *     publisher_user_map: array<string, MagicUserEntity>,
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

        // Use the user's preferred language and fall back to en_US.
        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;

        // Build the market query object.
        $query = new AgentMarketQuery();
        $query->setKeyword(trim($requestDTO->getKeyword()));
        $query->setLanguageCode($languageCode);
        if ($requestDTO->getCategoryId()) {
            $query->setCategoryId((int) $requestDTO->getCategoryId());
        }

        // Build the page request.
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        // Fetch the published market list.
        $result = $this->superMagicAgentMarketDomainService->queries($query, $page);
        $agentMarkets = $result['list'];
        $total = $result['total'];

        if (empty($agentMarkets)) {
            return [
                'agent_markets' => [],
                'publisher_user_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'playbooks_map' => [],
                'official_agent_codes' => [],
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
                'total' => $total,
            ];
        }

        // Load the current user's installed agents to compute is_added.
        $agentCodes = array_map(fn ($agentMarket) => $agentMarket->getAgentCode(), $agentMarkets);
        $publisherUserMap = $this->loadPublisherUserMap($agentMarkets);
        $userAgentsMap = $this->superMagicAgentMarketDomainService->getUserAgentsByAgentCodes(
            $dataIsolation,
            $agentCodes
        );
        $userAgentsMap = $this->mergeVisibleAgentOwnerships($dataIsolation, $agentCodes, $userAgentsMap);
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getCurrentOrLatestByCodes($dataIsolation, $agentCodes);

        // Load playbooks in batch for the list cards.
        $agentVersionIds = array_map(fn ($agentMarket) => $agentMarket->getAgentVersionId(), $agentMarkets);
        $playbooksMap = $this->superMagicAgentMarketDomainService->getPlaybooksByAgentVersionIds($agentVersionIds);

        // 官方内置员工
        $officialAgentCodes = $this->getOfficialAgentCodes($authorization);
        foreach ($agentMarkets as $agentMarket) {
            if (in_array($agentMarket->getAgentCode(), $officialAgentCodes)) {
                $agentMarket->setPublisherType(PublisherType::OFFICIAL_BUILTIN);
            }
        }

        $this->updateAgentMarketIcon($dataIsolation, $agentMarkets);

        return [
            'agent_markets' => $agentMarkets,
            'publisher_user_map' => $publisherUserMap,
            'user_agents_map' => $userAgentsMap,
            'latest_versions_map' => $latestVersionsMap,
            'playbooks_map' => $playbooksMap,
            'page' => $requestDTO->getPage(),
            'page_size' => $requestDTO->getPageSize(),
            'total' => $total,
        ];
    }

    /**
     * Resolve the market icon path into a public URL when possible.
     *
     * @param AgentMarketEntity|array<int, AgentMarketEntity> $agentMarket
     */
    private function updateAgentMarketIcon(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentMarketEntity|array $agentMarket
    ): void {
        $agentMarkets = $agentMarket instanceof AgentMarketEntity ? [$agentMarket] : $agentMarket;
        if ($agentMarkets === []) {
            return;
        }

        $pathMapByOrganization = [];
        foreach ($agentMarkets as $marketEntity) {
            if (! $marketEntity instanceof AgentMarketEntity) {
                continue;
            }

            $icon = $marketEntity->getIcon() ?? [];
            $formattedPath = EasyFileTools::formatPath($icon['url'] ?? $icon['value'] ?? '');
            if ($formattedPath === '') {
                continue;
            }

            $organizationCode = $marketEntity->getOrganizationCode() ?: $dataIsolation->getCurrentOrganizationCode();
            $pathMapByOrganization[$organizationCode][$formattedPath] = true;
        }

        if ($pathMapByOrganization === []) {
            return;
        }

        $fileLinksByOrganization = [];
        foreach ($pathMapByOrganization as $organizationCode => $pathMap) {
            $fileLinksByOrganization[$organizationCode] = $this->getIcons($organizationCode, array_keys($pathMap));
        }

        foreach ($agentMarkets as $marketEntity) {
            if (! $marketEntity instanceof AgentMarketEntity) {
                continue;
            }

            $icon = $marketEntity->getIcon() ?? [];
            $formattedPath = EasyFileTools::formatPath($icon['url'] ?? $icon['value'] ?? '');
            if ($formattedPath === '') {
                continue;
            }

            $organizationCode = $marketEntity->getOrganizationCode() ?: $dataIsolation->getCurrentOrganizationCode();
            $fileLink = $fileLinksByOrganization[$organizationCode][$formattedPath] ?? null;
            if ($fileLink === null) {
                continue;
            }

            $icon['url'] = $fileLink->getUrl();
            $icon['value'] = $fileLink->getUrl();
            $marketEntity->setIcon($icon);
        }
    }

    /**
     * Merge visible non-market agents into the ownership map so the UI can treat
     * them as already added while keeping delete disabled.
     *
     * @param string[] $agentCodes
     * @param array<string, UserAgentEntity> $userAgentsMap
     * @return array<string, UserAgentEntity>
     */
    private function mergeVisibleAgentOwnerships(
        SuperMagicAgentDataIsolation $dataIsolation,
        array $agentCodes,
        array $userAgentsMap
    ): array {
        $accessibleAgentResult = $this->getAccessibleAgentCodes($dataIsolation, $dataIsolation->getCurrentUserId());
        $visibleAgentCodes = array_intersect($agentCodes, $accessibleAgentResult['codes']);

        foreach ($visibleAgentCodes as $agentCode) {
            if (isset($userAgentsMap[$agentCode])) {
                continue;
            }

            $userAgentsMap[$agentCode] = (new UserAgentEntity())
                ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
                ->setUserId($dataIsolation->getCurrentUserId())
                ->setAgentCode($agentCode)
                ->setSourceType(AgentSourceType::LOCAL_CREATE);
        }

        return $userAgentsMap;
    }

    /**
     * @param AgentMarketEntity[] $agentMarkets
     * @return array<string, MagicUserEntity>
     */
    private function loadPublisherUserMap(array $agentMarkets): array
    {
        $publisherIds = [];
        foreach ($agentMarkets as $agentMarket) {
            if ($agentMarket->getPublisherType() !== PublisherType::OFFICIAL) {
                $publisherIds[] = $agentMarket->getPublisherId();
            }
        }

        if ($publisherIds === []) {
            return [];
        }

        $publisherUserMap = [];
        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization(array_unique($publisherIds));
        foreach ($userEntities as $userEntity) {
            $publisherUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $publisherUserMap;
    }
}
