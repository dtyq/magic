<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketVectorIndexDomainService;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 市场 Skill 应用服务.
 */
class SkillMarketAppService extends AbstractSkillAppService
{
    private LoggerInterface $logger;

    public function __construct(
        protected SkillMarketDomainService $skillMarketDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected SkillCategoryRelationDomainService $skillCategoryRelationDomainService,
        protected SkillMarketVectorIndexDomainService $skillMarketVectorIndexDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('vector-index-sync');
    }

    /**
     * Return the market detail for a published skill.
     *
     * @return array{
     *     skillMarket: SkillMarketEntity,
     *     skillVersion: SkillVersionEntity,
     *     isAdded: bool,
     *     isCreator: bool,
     *     publisherUser: ?MagicUserEntity,
     *     skillFileUrl: string
     * }
     */
    public function show(RequestContext $requestContext, string $code): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $skillMarket = $this->skillMarketDomainService->findPublishedBySkillCode($code);
        if ($skillMarket === null) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_NOT_FOUND, 'skill.store_skill_not_found');
        }
        $skillMarket->setCategoryIds($this->skillCategoryRelationDomainService->getMarketCategoryIds($skillMarket->getId() ?? 0));

        $skillVersion = $this->skillVersionDomainService->findSkillVersionByIdWithoutOrganizationFilter(
            $skillMarket->getSkillVersionId()
        );
        if ($skillVersion === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        $this->updateSkillMarketLogoUrl($dataIsolation, [$skillMarket]);
        $this->updateSkillVersionAssetUrls($dataIsolation, [$skillVersion]);

        $publisherUser = null;
        if ($skillMarket->getPublisherType()->isUser()) {
            $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization([$skillMarket->getPublisherId()]);
            $this->updateUserAvatarUrl($dataIsolation, $userEntities);
            foreach ($userEntities as $userEntity) {
                if ($userEntity->getUserId() === $skillMarket->getPublisherId()) {
                    $publisherUser = $userEntity;
                    break;
                }
            }
        }

        $isAdded = $skillVersion->getSourceType()->isSystem() || $this->skillDomainService->isSkillAdded($dataIsolation, $code);
        $isCreator = $skillVersion->getCreatorId() === $dataIsolation->getCurrentUserId();

        return [
            'skillMarket' => $skillMarket,
            'skillVersion' => $skillVersion,
            'isAdded' => $isCreator ?: $isAdded,
            'isCreator' => $isCreator,
            'publisherUser' => $publisherUser,
            'skillFileUrl' => $this->resolvePublishedSkillFileUrl($skillVersion),
        ];
    }

    /**
     * 获取市场技能库列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @param bool $withFileUrl 是否加载版本文件 URL
     * @return array{list: SkillMarketEntity[], userSkills: array<string, SkillEntity>, publisherUserMap: array<string, MagicUserEntity>, skillVersionMap: array<string, SkillVersionEntity>, total?: int} 市场技能列表结果
     */
    public function queries(RequestContext $requestContext, SkillQuery $query, Page $page, bool $withFileUrl = true): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
        $dataIsolation->disabled();

        // 按 skill_code 过滤
        if ($query->getCodes() !== null) {
            $normalizedCodes = array_values(array_unique(array_filter($query->getCodes())));
            $query->setCodes($normalizedCodes);
        }

        $result = $this->queryMarketSkills($dataIsolation, $query, $page);

        $data = $this->resolveMarketListData($dataIsolation, $result['list'], $withFileUrl);

        $resultData = ['list' => $result['list']] + $data;
        if ($page->isTotal()) {
            $resultData['total'] = $result['total'];
        }

        return $resultData;
    }

    /** Use semantic ranking when available; otherwise fall back to MySQL. */
    private function queryMarketSkills(SkillDataIsolation $dataIsolation, SkillQuery $query, Page $page): array
    {
        if ($query->getKeyword() !== null && trim($query->getKeyword()) !== '') {
            try {
                if ($this->skillMarketVectorIndexDomainService->isVectorSearchReady()
                    && $this->skillMarketVectorIndexDomainService->isAvailable()) {
                    return [
                        'total' => null,
                        'list' => $this->skillMarketVectorIndexDomainService->search($dataIsolation, $query, $page),
                    ];
                }
            } catch (Throwable $throwable) {
                $this->logger->warning('Skill market semantic search fell back to MySQL', [
                    'exception' => $throwable::class,
                    'message' => $throwable->getMessage(),
                ]);
            }
        }

        return $this->skillMarketDomainService->queries($query, $page);
    }

    /**
     * 填充市场列表展示所需的分类、用户技能、版本、发布者和资源 URL.
     *
     * @param SkillMarketEntity[] $skillMarketEntities 市场技能实体
     * @param bool $withFileUrl 是否加载版本文件 URL
     * @return array{userSkills: array<string, SkillEntity>, publisherUserMap: array<string, MagicUserEntity>, skillVersionMap: array<string, SkillVersionEntity>}
     */
    private function resolveMarketListData(SkillDataIsolation $dataIsolation, array $skillMarketEntities, bool $withFileUrl = true): array
    {
        if (empty($skillMarketEntities)) {
            return [
                'userSkills' => [],
                'publisherUserMap' => [],
                'skillVersionMap' => [],
            ];
        }

        // 查询用户已添加的技能（用于判断 is_added）
        $skillCodes = array_map(fn ($entity) => $entity->getSkillCode(), $skillMarketEntities);
        $userSkillsMap = $this->skillDomainService->findByVersionCodes($dataIsolation, $skillCodes);
        $skillVersionMap = $this->skillVersionDomainService->findSkillCurrentOrLatestByCodes($dataIsolation, $skillCodes);

        if ($withFileUrl) {
            $this->updateSkillVersionAssetUrls($dataIsolation, array_values($skillVersionMap));
        }

        // 批量更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillMarketLogoUrl($dataIsolation, $skillMarketEntities);

        // 批量查询发布者用户信息（仅查询非官方类型的发布者）
        $publisherIds = [];
        foreach ($skillMarketEntities as $entity) {
            if ($entity->getPublisherType()->isUser()) {
                $publisherIds[] = $entity->getPublisherId();
            }
        }
        $publisherIds = array_unique($publisherIds);
        $publisherUserMap = [];
        if (! empty($publisherIds)) {
            $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($publisherIds);
            $this->updateUserAvatarUrl($dataIsolation, $userEntities);
            foreach ($userEntities as $userEntity) {
                $publisherUserMap[$userEntity->getUserId()] = $userEntity;
            }
        }

        return [
            'userSkills' => $userSkillsMap,
            'publisherUserMap' => $publisherUserMap,
            'skillVersionMap' => $skillVersionMap,
        ];
    }

    /**
     * Generate a market detail skill file URL from the published version snapshot.
     */
    private function resolvePublishedSkillFileUrl(SkillVersionEntity $skillVersion): string
    {
        $skillFileKey = $skillVersion->getSkillFileKey();
        if ($skillFileKey === null || $skillFileKey === '') {
            return '';
        }

        return $this->fileDomainService->getLink(
            $skillVersion->getOrganizationCode(),
            $skillFileKey,
            StorageBucketType::Private,
        )?->getUrl() ?? '';
    }
}
