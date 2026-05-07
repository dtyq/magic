<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;

/**
 * 市场 Skill 应用服务.
 */
class SkillMarketAppService extends AbstractSkillAppService
{
    public function __construct(
        FileDomainService $fileDomainService,
        protected SkillDomainService $skillDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected TaskFileDomainService $taskFileDomainService
    ) {
        parent::__construct($fileDomainService);
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

        $skillVersion = $this->skillDomainService->findSkillVersionByIdWithoutOrganizationFilter(
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
     * @return array{list: SkillMarketEntity[], total: int, userSkills: array<string, SkillEntity>, publisherUserMap: array<string, MagicUserEntity>, skillVersionMap: array<string, SkillVersionEntity>} 市场技能列表结果
     */
    public function queries(RequestContext $requestContext, SkillQuery $query, Page $page): array
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

        // 查询市场技能列表（包含总数）
        $result = $this->skillMarketDomainService->queries($query, $page);

        $skillMarketEntities = $result['list'];
        $total = $result['total'];

        if (empty($skillMarketEntities)) {
            return [
                'list' => [],
                'total' => $total,
                'userSkills' => [],
                'publisherUserMap' => [],
                'skillVersionMap' => [],
            ];
        }

        // 查询用户已添加的技能（用于判断 is_added）
        $skillCodes = array_map(fn ($entity) => $entity->getSkillCode(), $skillMarketEntities);
        $userSkillsMap = $this->skillDomainService->findByVersionCodes($dataIsolation, $skillCodes);
        $skillVersionMap = $this->skillDomainService->findSkillCurrentOrLatestByCodes($dataIsolation, $skillCodes);

        $this->updateSkillVersionAssetUrls($dataIsolation, array_values($skillVersionMap));

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
            'list' => $skillMarketEntities,
            'total' => $total,
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

        $taskFileEntity = new TaskFileEntity();
        $taskFileEntity->setFileKey($skillFileKey);
        $taskFileEntity->setFileName(basename($skillFileKey));
        $taskFileEntity->setIsDirectory(false);

        return $this->taskFileDomainService->getFilePreSignedUrl(
            $skillVersion->getOrganizationCode(),
            $taskFileEntity
        );
    }
}
