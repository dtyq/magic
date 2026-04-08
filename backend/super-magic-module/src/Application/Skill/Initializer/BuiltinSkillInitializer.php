<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Initializer;

use App\Infrastructure\Util\OfficialOrganizationUtil;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\BuiltinSkill;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * 幂等同步系统 Skill 的基础数据、当前版本和市场记录。
 */
class BuiltinSkillInitializer
{
    private const SYSTEM_CREATOR_ID = '0';

    private const DEFAULT_VERSION = '1.0.0';

    public function __construct(
        private readonly SkillDomainService $skillDomainService,
        private readonly SkillMarketDomainService $skillMarketDomainService,
    ) {
    }

    /**
     * 供 migration/命令统一调用的静态入口。
     *
     * @return array{success: bool, message: string, count: int}
     */
    public static function init(): array
    {
        return di(self::class)->doInit();
    }

    /**
     * 按 BuiltinSkill 清单逐个同步，已存在则更新，不存在则创建。
     *
     * @return array{success: bool, message: string, count: int}
     */
    public function doInit(): array
    {
        $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        if ($officialOrganizationCode === '') {
            return [
                'success' => false,
                'message' => 'Official organization code not configured',
                'count' => 0,
            ];
        }

        $dataIsolation = SkillDataIsolation::create($officialOrganizationCode, self::SYSTEM_CREATOR_ID);
        $dataIsolation->disabled();

        $count = 0;

        Db::beginTransaction();
        try {
            foreach (BuiltinSkill::getAllBuiltinSkills() as $builtinSkill) {
                $skillEntity = $this->syncSkillEntity($dataIsolation, $officialOrganizationCode, $builtinSkill);
                $skillVersionEntity = $this->syncSkillVersionEntity($dataIsolation, $officialOrganizationCode, $builtinSkill);
                $this->syncSkillPointers($dataIsolation, $skillEntity, $skillVersionEntity, $builtinSkill);
                $this->syncSkillMarketEntity($officialOrganizationCode, $skillVersionEntity, $builtinSkill);
                ++$count;
            }

            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();

            return [
                'success' => false,
                'message' => $throwable->getMessage(),
                'count' => 0,
            ];
        }

        return [
            'success' => true,
            'message' => 'Builtin skills synchronized successfully',
            'count' => $count,
        ];
    }

    private function syncSkillEntity(
        SkillDataIsolation $dataIsolation,
        string $organizationCode,
        BuiltinSkill $builtinSkill,
    ): SkillEntity {
        // 先按 code 复用已有基础记录，保证重复执行时不会重复插入。
        $skillEntity = $this->skillDomainService->findOptionalSkillByCode($dataIsolation, $builtinSkill->value) ?? new SkillEntity();

        $skillEntity->setOrganizationCode($organizationCode);
        $skillEntity->setCode($builtinSkill->value);
        $skillEntity->setCreatorId(self::SYSTEM_CREATOR_ID);
        $skillEntity->setPackageName($builtinSkill->getPackageName());
        $skillEntity->setPackageDescription($builtinSkill->getSkillDescription());
        $skillEntity->setNameI18n($builtinSkill->getNameI18n());
        $skillEntity->setDescriptionI18n($builtinSkill->getDescriptionI18n());
        $skillEntity->setSourceI18n($builtinSkill->getSourceI18n());
        $skillEntity->setLogo($builtinSkill->getSkillIcon() !== '' ? $builtinSkill->getSkillIcon() : null);
        $skillEntity->setFileKey('');
        $skillEntity->setSourceType(SkillSourceType::SYSTEM);
        $skillEntity->setSourceId(null);
        $skillEntity->setSourceMeta(null);
        $skillEntity->setIsEnabled(true);

        return $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
    }

    private function syncSkillVersionEntity(
        SkillDataIsolation $dataIsolation,
        string $organizationCode,
        BuiltinSkill $builtinSkill,
    ): SkillVersionEntity {
        // 系统 Skill 始终只维护一条“当前版本”记录，重复执行时直接同步这条记录。
        $skillVersionEntity = $this->skillDomainService->findLatestSkillVersionByCode($dataIsolation, $builtinSkill->value) ?? new SkillVersionEntity();
        $publishedAt = $skillVersionEntity->getPublishedAt() ?: date('Y-m-d H:i:s');
        $version = $skillVersionEntity->getId() !== null ? $skillVersionEntity->getVersion() : self::DEFAULT_VERSION;
        if ($version === '') {
            $version = self::DEFAULT_VERSION;
        }

        // 先清空旧的 current 标记，再把本次同步结果设为当前版本。
        $this->skillDomainService->clearCurrentVersionByCode($dataIsolation, $builtinSkill->value);

        $skillVersionEntity->setCode($builtinSkill->value);
        $skillVersionEntity->setOrganizationCode($organizationCode);
        $skillVersionEntity->setCreatorId(self::SYSTEM_CREATOR_ID);
        $skillVersionEntity->setPackageName($builtinSkill->getPackageName());
        $skillVersionEntity->setPackageDescription($builtinSkill->getSkillDescription());
        $skillVersionEntity->setVersion($version);
        $skillVersionEntity->setNameI18n($builtinSkill->getNameI18n());
        $skillVersionEntity->setDescriptionI18n($builtinSkill->getDescriptionI18n());
        $skillVersionEntity->setSourceI18n($builtinSkill->getSourceI18n());
        $skillVersionEntity->setLogo($builtinSkill->getSkillIcon() !== '' ? $builtinSkill->getSkillIcon() : null);
        $skillVersionEntity->setFileKey('');
        $skillVersionEntity->setSkillFileKey(null);
        $skillVersionEntity->setPublishStatus(PublishStatus::PUBLISHED);
        $skillVersionEntity->setReviewStatus(ReviewStatus::APPROVED);
        $skillVersionEntity->setPublishTargetType(PublishTargetType::MARKET);
        $skillVersionEntity->setPublishTargetValue(null);
        $skillVersionEntity->setVersionDescriptionI18n($builtinSkill->getDescriptionI18n());
        $skillVersionEntity->setPublisherUserId(self::SYSTEM_CREATOR_ID);
        $skillVersionEntity->setPublishedAt($publishedAt);
        $skillVersionEntity->setIsCurrentVersion(true);
        $skillVersionEntity->setSourceType(SkillSourceType::SYSTEM);
        $skillVersionEntity->setSourceId(null);
        $skillVersionEntity->setSourceMeta(null);

        return $this->skillDomainService->saveSkillVersion($dataIsolation, $skillVersionEntity);
    }

    private function syncSkillPointers(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillVersionEntity $skillVersionEntity,
        BuiltinSkill $builtinSkill,
    ): void {
        // 基础记录上的展示字段和当前版本指针始终与系统最新定义保持一致。
        $skillEntity->setPackageName($builtinSkill->getPackageName());
        $skillEntity->setPackageDescription($builtinSkill->getSkillDescription());
        $skillEntity->setNameI18n($builtinSkill->getNameI18n());
        $skillEntity->setDescriptionI18n($builtinSkill->getDescriptionI18n());
        $skillEntity->setSourceI18n($builtinSkill->getSourceI18n());
        $skillEntity->setLogo($builtinSkill->getSkillIcon() !== '' ? $builtinSkill->getSkillIcon() : null);
        $skillEntity->setFileKey('');
        $skillEntity->setVersionId($skillVersionEntity->getId());
        $skillEntity->setVersionCode($skillVersionEntity->getVersion());
        $skillEntity->setLatestPublishedAt($skillVersionEntity->getPublishedAt());
        $skillEntity->setSourceType(SkillSourceType::SYSTEM);
        $skillEntity->setIsEnabled(true);

        $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
    }

    private function syncSkillMarketEntity(
        string $organizationCode,
        SkillVersionEntity $skillVersionEntity,
        BuiltinSkill $builtinSkill,
    ): void {
        // 市场记录按 skill_code 幂等同步，确保系统 Skill 始终可见且标记为官方内置。
        $skillMarketEntity = $this->skillMarketDomainService->findStoreSkillBySkillCode($builtinSkill->value) ?? new SkillMarketEntity();

        $skillMarketEntity->setOrganizationCode($organizationCode);
        $skillMarketEntity->setSkillCode($builtinSkill->value);
        $skillMarketEntity->setSkillVersionId((int) $skillVersionEntity->getId());
        $skillMarketEntity->setNameI18n($builtinSkill->getNameI18n());
        $skillMarketEntity->setDescriptionI18n($builtinSkill->getDescriptionI18n());
        $skillMarketEntity->setSearchText($skillVersionEntity->getSearchText());
        $skillMarketEntity->setLogo($builtinSkill->getSkillIcon() !== '' ? $builtinSkill->getSkillIcon() : null);
        $skillMarketEntity->setPublisherId(self::SYSTEM_CREATOR_ID);
        $skillMarketEntity->setPublisherType(PublisherType::OFFICIAL_BUILTIN);
        $skillMarketEntity->setPublishStatus(PublishStatus::PUBLISHED);

        $this->skillMarketDomainService->saveStoreSkill($skillMarketEntity);
    }
}
