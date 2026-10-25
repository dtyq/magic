<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Application\SuperMagic\Skill\DTO\SkillPackageDTO;
use App\Application\SuperMagic\Skill\Import\SkillPackageParser;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Domain\SuperMagic\Skill\Event\SkillMarketCreatedEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketUpdatedEvent;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ImportOfficialSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\OfficialSkillImportPreviewDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\OfficialSkillImportResultDTO;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Hyperf\DbConnection\Db;
use Throwable;

final class AdminOfficialSkillAppService extends AbstractSkillAppService
{
    private const IMPORT_TOKEN_PREFIX = 'official_skill_import_token:';

    private const LOCK_PREFIX = 'official_skill_import:';

    public function __construct(
        private readonly SkillPackageParser $skillPackageParser,
        private readonly SkillVersionDomainService $officialSkillVersionDomainService,
        private readonly SkillMarketDomainService $officialSkillMarketDomainService,
        private readonly SkillCategoryDomainService $officialSkillCategoryDomainService,
        private readonly SkillCategoryRelationDomainService $officialSkillCategoryRelationDomainService,
    ) {
    }

    /**
     * 解析官方 Skill 导入文件，并生成确认导入所需的预填信息。
     */
    public function parseImport(
        RequestContext $requestContext,
        string $fileKey
    ): OfficialSkillImportPreviewDTO {
        $authorization = $this->assertOfficialOrganization($requestContext);
        $organizationCode = $authorization->getOrganizationCode();
        // 解析压缩包，获取官方 Skill 的包名和描述。
        $package = $this->skillPackageParser->parseByFileKey($organizationCode, $fileKey);
        // 通过官方组织和包名判断当前导入是新建还是更新。
        $market = $this->officialSkillMarketDomainService->findOfficialSkillByPackageName($package->packageName);
        $isUpdate = $market !== null;

        $version = $market === null ? null
            : $this->officialSkillVersionDomainService->findSkillVersionByIdWithoutOrganizationFilter($market->getSkillVersionId());

        $code = $market?->getSkillCode() ?? SkillEntity::generateNewCode();

        // 更新场景回显已有分类，新建场景不预设分类。
        $categoryIds = $market === null ? [] : $this->officialSkillCategoryRelationDomainService->getMarketCategoryIds($market->getId() ?? 0);

        // 保存解析结果，确认导入时通过 Token 恢复文件信息。
        $token = $this->createImportToken(self::IMPORT_TOKEN_PREFIX, [
            'organization_code' => $organizationCode,
            'operator_id' => $authorization->getId(),
            'file_key' => $fileKey,
            'package_name' => $package->packageName,
            'skill_code' => $code,
            'package_description' => $package->packageDescription,
        ]);

        $dataIsolation = SkillDataIsolation::create($organizationCode, $authorization->getId());
        $dataIsolation->disabled();

        return new OfficialSkillImportPreviewDTO(
            importToken: $token,
            code: $code,
            packageName: $package->packageName,
            packageDescription: $package->packageDescription,
            isUpdate: $isUpdate,
            nameI18n: $market?->getNameI18n() ?: $this->buildDefaultNameI18n($package->packageName),
            descriptionI18n: $market?->getDescriptionI18n() ?: $this->buildDefaultDescriptionI18n($package->packageDescription),
            logo: $this->resolveLogoUrl($organizationCode, $market?->getLogo()),
            id: $market === null ? '' : (string) $market->getId(),
            publisherType: $market?->getPublisherType()->value ?? PublisherType::OFFICIAL->value,
            isFeatured: $market?->isFeatured() ?? false,
            isHidden: $market?->isHidden() ?? false,
            sortOrder: $market?->getSortOrder() ?? 0,
            version: $this->resolveImportVersion($dataIsolation, $code, $market, $version),
            categories: $this->buildCategories($categoryIds),
        );
    }

    /**
     * 导入官方 Skill 版本、市场信息和分类关系.
     */
    public function import(
        RequestContext $requestContext,
        ImportOfficialSkillRequestDTO $requestDTO
    ): OfficialSkillImportResultDTO {
        $authorization = $this->assertOfficialOrganization($requestContext);
        $organizationCode = $authorization->getOrganizationCode();
        // 解析压缩包，确定官方 Skill 的包名和描述。
        $package = $this->resolveImportPackage($authorization, $requestDTO);

        $lockKey = self::LOCK_PREFIX . $organizationCode . ':' . $package->packageName;
        $lockOwner = '';

        try {
            // 锁定同名官方 Skill，并在一个事务中更新版本、市场和分类。
            $lockOwner = $this->acquireImportLock($lockKey);
            Db::beginTransaction();
            try {
                $result = $this->saveOfficialSkillImport($organizationCode, $authorization, $package, $requestDTO);

                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        } finally {
            $this->releaseImportLock($lockKey, $lockOwner);
        }

        if ($result->getMarketId() !== null) {
            $eventClass = $result->getAction() === 'created'
                ? SkillMarketCreatedEvent::class
                : SkillMarketUpdatedEvent::class;
            AsyncEventUtil::dispatch(new $eventClass(
                (string) $result->getMarketId(),
                $organizationCode,
                $authorization->getId(),
            ));
        }

        // 事务提交后再删除 Token，避免失败重试时丢失导入信息。
        $this->removeImportToken(self::IMPORT_TOKEN_PREFIX, $requestDTO->getImportToken());

        return $result;
    }

    private function buildDefaultNameI18n(string $packageName): array
    {
        return ['default' => $packageName];
    }

    private function buildDefaultDescriptionI18n(string $packageDescription): array
    {
        return ['default' => $packageDescription];
    }

    private function resolveImportPackage(MagicUserAuthorization $authorization, ImportOfficialSkillRequestDTO $requestDTO): SkillPackageDTO
    {
        if ($requestDTO->getImportToken() !== '') {
            // 优先复用解析阶段的 Token，避免重复下载和解析文件。
            $tokenData = $this->readImportToken(self::IMPORT_TOKEN_PREFIX, $requestDTO->getImportToken());
            if (($tokenData['organization_code'] ?? '') !== $authorization->getOrganizationCode()) {
                ExceptionBuilder::throw(SkillErrorCode::IMPORT_TOKEN_EXPIRED, 'skill.import_token_expired');
            }
            return new SkillPackageDTO(
                (string) $tokenData['file_key'],
                (string) ($tokenData['package_name'] ?? $tokenData['skill_code']),
                (string) ($tokenData['package_description'] ?? ''),
                isset($tokenData['skill_code']) ? (string) $tokenData['skill_code'] : null,
            );
        }

        // 没有 Token 时直接解析本次上传的文件。
        return $this->skillPackageParser->parseByFileKey($authorization->getOrganizationCode(), $requestDTO->getFileKey());
    }

    /**
     * 保存官方 Skill 的版本、市场信息和分类关系.
     */
    private function saveOfficialSkillImport(
        string $organizationCode,
        MagicUserAuthorization $authorization,
        SkillPackageDTO $package,
        ImportOfficialSkillRequestDTO $requestDTO
    ): OfficialSkillImportResultDTO {
        // 按官方组织和包名查找已有市场记录，决定复用编码还是生成新编码。
        $market = $this->officialSkillMarketDomainService->findOfficialSkillByPackageName($package->packageName);
        $isUpdate = $market !== null;
        $code = $market?->getSkillCode() ?? $package->skillCode ?? SkillEntity::generateNewCode();
        // 先保存版本，再将市场记录指向当前版本。
        $version = $this->saveOfficialSkillVersion($organizationCode, $authorization, $package, $requestDTO, $market, $code);
        $market = $this->saveOfficialSkillMarket($authorization, $requestDTO, $version, $market, $code);

        // 使用同一份分类数据同步维护版本和市场关系。
        $categoryIds = $this->officialSkillCategoryRelationDomainService->normalizeCategoryIds(
            $requestDTO->getCategoryIdList()
        );
        $this->officialSkillCategoryRelationDomainService->replaceVersionCategories(
            $organizationCode,
            (int) $version->getId(),
            $categoryIds
        );
        $this->officialSkillCategoryRelationDomainService->replaceMarketCategories(
            $organizationCode,
            (int) $market->getId(),
            $categoryIds
        );

        return new OfficialSkillImportResultDTO(
            $code,
            $version->getVersion(),
            $isUpdate ? 'updated' : 'created',
            $market->getId(),
            $version->getId()
        );
    }

    private function saveOfficialSkillVersion(
        string $organizationCode,
        MagicUserAuthorization $authorization,
        SkillPackageDTO $package,
        ImportOfficialSkillRequestDTO $requestDTO,
        ?SkillMarketEntity $market,
        string $code
    ): SkillVersionEntity {
        // 更新时复用当前版本并清理旧的 current 标记，新建时创建版本记录。
        $dataIsolation = SkillDataIsolation::create($organizationCode, $authorization->getId());
        $dataIsolation->disabled();
        $version = $market === null ? new SkillVersionEntity() : $this->officialSkillVersionDomainService->findSkillVersionByIdWithoutOrganizationFilter($market->getSkillVersionId());
        $version ??= new SkillVersionEntity();
        if ($this->officialSkillVersionDomainService->existsByCodeAndVersion(
            $dataIsolation,
            $code,
            $requestDTO->getVersion(),
            $version->getId(),
        )) {
            ExceptionBuilder::throw(SkillErrorCode::VERSION_ALREADY_EXISTS, 'skill.version_already_exists');
        }
        if ($version->getId() !== null) {
            $this->officialSkillVersionDomainService->clearCurrentVersionByCode($dataIsolation, $code);
        }
        $version->setCode($code);
        $version->setOrganizationCode($organizationCode);
        $version->setCreatorId($authorization->getId());
        $version->setPackageName($package->packageName);
        $version->setPackageDescription($package->packageDescription);
        $version->setVersion($requestDTO->getVersion());
        $version->setNameI18n($requestDTO->getNameI18n());
        $version->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $version->setSourceI18n($requestDTO->getSourceI18n());
        $version->setLogo($this->normalizeLogoPath($requestDTO->getLogo()));
        $version->setFileKey($package->fileKey);
        $version->setPublishStatus($requestDTO->getPublishStatus());
        $version->setReviewStatus(ReviewStatus::APPROVED);
        $version->setPublishTargetType(PublishTargetType::MARKET);
        $version->setVersionDescriptionI18n($requestDTO->getDescriptionI18n());
        $version->setPublisherUserId($authorization->getId());
        $version->setPublishedAt($requestDTO->getPublishStatus() === PublishStatus::PUBLISHED->value ? date('Y-m-d H:i:s') : null);
        $version->setIsCurrentVersion(true);
        $version->setSourceType(SkillSourceType::OFFICIAL);
        $version->setSourceId(null);
        $version->setSourceMeta(['imported_by' => $authorization->getId()]);
        $version->setProjectId(null);

        $version = $this->officialSkillVersionDomainService->saveSkillVersion($dataIsolation, $version);
        $version->setSkillFileKey($this->uploadSkillFileFromPackage($version));
        return $this->officialSkillVersionDomainService->saveSkillVersion($dataIsolation, $version);
    }

    private function saveOfficialSkillMarket(
        MagicUserAuthorization $authorization,
        ImportOfficialSkillRequestDTO $requestDTO,
        SkillVersionEntity $version,
        ?SkillMarketEntity $market,
        string $code
    ): SkillMarketEntity {
        // 保存市场展示信息、发布状态和发布方信息。
        $market ??= new SkillMarketEntity();
        $market->setOrganizationCode($authorization->getOrganizationCode());
        $market->setSkillCode($code);
        $market->setSkillVersionId((int) $version->getId());
        $market->setNameI18n($requestDTO->getNameI18n());
        $market->setDescriptionI18n($requestDTO->getDescriptionI18n());
        $market->setSearchText($version->getSearchText());
        $market->setLogo($this->normalizeLogoPath($requestDTO->getLogo()));
        // 官方导入只能创建或更新官方发布的 Skill，不使用请求中的发布者身份。
        $market->setPublisherId($authorization->getOrganizationCode());
        $market->setPublisherType(PublisherType::OFFICIAL);
        $market->setPublishStatus($requestDTO->getPublishStatus());
        $market->setIsHidden($requestDTO->isHidden());
        $market->setIsFeatured($requestDTO->isFeatured());
        $market->setSortOrder($requestDTO->getSortOrder());

        return $this->officialSkillMarketDomainService->saveStoreSkill($market);
    }

    private function normalizeLogoPath(string $logo): ?string
    {
        if ($logo === '') {
            return null;
        }

        $logoPath = EasyFileTools::formatPath($logo);
        return $logoPath !== '' ? $logoPath : null;
    }

    private function resolveLogoUrl(string $organizationCode, ?string $logo): string
    {
        if ($logo === null || $logo === '') {
            return '';
        }

        $logoPath = EasyFileTools::formatPath($logo);
        if ($logoPath === '') {
            return '';
        }

        $fileLink = $this->getIcons($organizationCode, [$logoPath])[$logoPath] ?? null;
        return $fileLink?->getUrl() ?? $logo;
    }

    private function resolveImportVersion(
        SkillDataIsolation $dataIsolation,
        string $code,
        ?SkillMarketEntity $market,
        ?SkillVersionEntity $version
    ): string {
        return $this->officialSkillVersionDomainService->getNextAvailableVersion(
            $dataIsolation,
            $code,
            $market === null ? null : ($version?->getVersion() ?? ''),
        );
    }

    /** @param array<int, int> $categoryIds @return array<int, array{id: string, name: string}> */
    private function buildCategories(array $categoryIds): array
    {
        if ($categoryIds === []) {
            return [];
        }

        $categories = [];
        foreach ($this->officialSkillCategoryDomainService->findByIds($categoryIds) as $category) {
            $categories[(int) $category->getId()] = [
                'id' => (string) $category->getId(),
                'name' => $category->getI18nName(CoContext::getLanguage()),
            ];
        }

        $result = [];
        foreach ($categoryIds as $categoryId) {
            if (isset($categories[$categoryId])) {
                $result[] = $categories[$categoryId];
            }
        }

        return $result;
    }

    private function assertOfficialOrganization(RequestContext $requestContext): MagicUserAuthorization
    {
        $authorization = $requestContext->getUserAuthorization();
        if (! OfficialOrganizationUtil::isOfficialOrganization($authorization->getOrganizationCode())) {
            ExceptionBuilder::throw(SkillErrorCode::OFFICIAL_ORGANIZATION_REQUIRED, 'skill.official_organization_required');
        }
        return $authorization;
    }
}
