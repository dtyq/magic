<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;

/**
 * 市场 Skill 应用服务.
 */
class SkillMarketAppService extends AbstractSkillAppService
{
    public function __construct(
        FileDomainService $fileDomainService,
        protected SkillDomainService $skillDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        protected MagicUserDomainService $magicUserDomainService
    ) {
        parent::__construct($fileDomainService);
    }

    /**
     * 获取市场技能库列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{list: SkillMarketEntity[], total: int, userSkills: array<string, SkillEntity>, publisherUserMap: array<string, MagicUserEntity>, creatorSkillCodes: array<string, bool>} 市场技能列表结果
     */
    public function queries(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        // 获取用户语言偏好，从 dataIsolation 中获取
        $languageCode = $query->getLanguageCode() ?: ($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);

        // 设置语言代码到查询对象
        if (! $query->getLanguageCode()) {
            $query->setLanguageCode($languageCode);
        }

        // 查询市场技能列表（包含总数）
        $result = $this->skillMarketDomainService->queries($query, $page);

        $storeSkillEntities = $result['list'];
        $total = $result['total'];

        if (empty($storeSkillEntities)) {
            return [
                'list' => [],
                'total' => $total,
                'userSkills' => [],
                'publisherUserMap' => [],
                'creatorSkillCodes' => [],
            ];
        }

        // 查询用户已添加的技能（用于判断 is_added 和 need_upgrade）
        $skillCodes = array_map(fn ($entity) => $entity->getSkillCode(), $storeSkillEntities);
        $userSkillsMap = $this->skillDomainService->findByVersionCodes($dataIsolation, $skillCodes);

        $creatorSkillCodes = [];
        $skillVersionIds = array_values(array_unique(array_map(
            static fn (SkillMarketEntity $entity) => $entity->getSkillVersionId(),
            $storeSkillEntities
        )));
        $skillVersionMap = $this->skillDomainService->findSkillVersionsByIdsWithoutOrganizationFilter($skillVersionIds);
        foreach ($storeSkillEntities as $storeSkillEntity) {
            $skillVersion = $skillVersionMap[$storeSkillEntity->getSkillVersionId()] ?? null;
            if ($skillVersion !== null) {
                $creatorSkillCodes[$storeSkillEntity->getSkillCode()] = $skillVersion->getCreatorId() === $dataIsolation->getCurrentUserId();
            }
        }

        // 批量更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillMarketLogoUrl($dataIsolation, $storeSkillEntities);

        // 批量查询发布者用户信息（仅查询非官方类型的发布者）
        $publisherIds = [];
        foreach ($storeSkillEntities as $entity) {
            if ($entity->getPublisherType() !== PublisherType::OFFICIAL) {
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
            'list' => $storeSkillEntities,
            'total' => $total,
            'userSkills' => $userSkillsMap,
            'publisherUserMap' => $publisherUserMap,
            'creatorSkillCodes' => $creatorSkillCodes,
        ];
    }
}
