<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Agent\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Agent\Entity\AgentMarketEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentPlaybookEntity;
use App\Domain\SuperMagic\Agent\Entity\AgentVersionEntity;
use App\Domain\SuperMagic\Agent\Entity\UserAgentEntity;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\Query\AgentMarketQuery;
use App\Domain\SuperMagic\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use App\Domain\SuperMagic\Agent\Service\AgentMarketVectorIndexDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentCategoryDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentMarketDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentPlaybookDomainService;
use App\Domain\SuperMagic\Agent\Service\SuperMagicAgentVersionDomainService;
use App\Domain\SuperMagic\Agent\Service\UserAgentDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\SuperMagic\Agent\DTO\Request\QueryAgentMarketsRequestDTO;
use Hyperf\Di\Annotation\Inject;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

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
    protected UserAgentDomainService $superMagicUserAgentDomainService;

    #[Inject]
    protected SuperMagicAgentPlaybookDomainService $superMagicAgentPlaybookDomainService;

    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    #[Inject]
    protected AgentMarketVectorIndexDomainService $agentMarketVectorIndexDomainService;

    /**
     * @return array<int, array{id:int, name_i18n:array, logo:?string, sort_order:int, status:int, crew_count:int}>
     */
    public function getCategories(Authenticatable $authorization, bool $includeEmpty = false): array
    {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);

        $categories = $this->superMagicAgentCategoryDomainService->getCategoriesWithCrewCount($includeEmpty);
        $this->updateCategoryLogoUrls($dataIsolation, $categories);

        $list = [];
        foreach ($categories as $category) {
            $list[] = [
                'id' => $category['id'],
                'name_i18n' => $category['name_i18n'],
                'logo' => ($category['logo'] ?? null) ?: null,
                'sort_order' => $category['sort_order'],
                'status' => $category['status'],
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
        $this->fillMarketCategoryIds([$agentMarket]);

        $this->assertMarketDiscoverableForUser(
            $this->createPermissionDataIsolation($dataIsolation),
            $agentMarket,
            $dataIsolation->getCurrentUserId()
        );

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
     *     total: ?int
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
        if ($requestDTO->getCategoryIds() !== []) {
            $query->setCategoryIds($requestDTO->getCategoryIds());
        }
        $query->setMarketType($requestDTO->getMarketType());

        $visibleMarketIds = $this->superMagicAgentMarketDomainService->getDiscoverableOrganizationMarketIds(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId()
        );
        $query->setVisibleOrganizationShelf(
            $dataIsolation->getCurrentOrganizationCode(),
            array_map('intval', $visibleMarketIds)
        );

        // Build the page request.
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        // Use semantic ranking only after the first complete index reconciliation.
        $result = $this->queryMarkets($dataIsolation, $query, $page);
        $agentMarkets = $result['list'];
        $this->fillMarketCategoryIds($agentMarkets);
        $total = $result['total'];

        if (empty($agentMarkets)) {
            return [
                'agent_markets' => [],
                'publisher_user_map' => [],
                'user_agents_map' => [],
                'latest_versions_map' => [],
                'playbooks_map' => [],
                'official_agent_codes' => [],
                'total' => $total,
            ];
        }

        // Load the current user's installed agents to compute is_added.
        $agentCodes = array_map(fn ($agentMarket) => $agentMarket->getAgentCode(), $agentMarkets);

        // load publisher user map
        $publisherUserMap = $this->loadPublisherUserMap($agentMarkets);

        // load user agents map
        $userAgentsMap = $this->superMagicUserAgentDomainService->findUserAgentOwnershipsByCodes($dataIsolation, $agentCodes);

        // load latest versions map
        $latestVersionsMap = $this->superMagicAgentVersionDomainService->getLatestPublishedByCodes($dataIsolation, $agentCodes);

        // Load playbooks in batch for the list cards.
        $agentVersionIds = array_map(fn ($agentMarket) => $agentMarket->getAgentVersionId(), $agentMarkets);
        $playbooksMap = $this->superMagicAgentPlaybookDomainService->getByAgentVersionIds($agentVersionIds);

        // get official agent codes
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
            'total' => $total,
        ];
    }

    /** Query Qdrant when ready and fall back to the authoritative MySQL query. */
    private function queryMarkets(
        SuperMagicAgentDataIsolation $dataIsolation,
        AgentMarketQuery $query,
        Page $page,
    ): array {
        if (trim((string) $query->getKeyword()) === ''
            || ! $this->agentMarketVectorIndexDomainService->isVectorSearchReady()
            || ! $this->agentMarketVectorIndexDomainService->isAvailable()) {
            return $this->superMagicAgentMarketDomainService->queries($query, $page);
        }

        try {
            return [
                'total' => null,
                'list' => $this->agentMarketVectorIndexDomainService->search(
                    $dataIsolation,
                    $query,
                    $page,
                ),
            ];
        } catch (Throwable $throwable) {
            $this->logger->warning('Agent market semantic search fell back to MySQL', [
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            return $this->superMagicAgentMarketDomainService->queries($query, $page);
        }
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
