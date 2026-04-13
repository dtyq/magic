<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Service;

use App\Domain\File\Repository\Persistence\Facade\CloudFileRepositoryInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use Dtyq\SuperMagic\Domain\Skill\Repository\Facade\UserSkillRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ExportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request\ImportWorkspaceRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\WorkspaceExporterInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\WorkspaceImporterInterface;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * Skill 领域服务.
 */
class SkillDomainService
{
    public function __construct(
        protected SkillRepositoryInterface $skillRepository,
        protected SkillVersionRepositoryInterface $skillVersionRepository,
        protected UserSkillRepositoryInterface $userSkillRepository,
        protected SkillMarketDomainService $skillMarketDomainService,
        protected CloudFileRepositoryInterface $cloudFileRepository,
        protected SandboxGatewayInterface $sandboxGateway,
        protected WorkspaceExporterInterface $workspaceExporter,
        protected WorkspaceImporterInterface $workspaceImporter,
    ) {
    }

    /**
     * 根据 code 查找用户技能并验证权限.
     * 验证技能是否属于当前用户组织且属于当前用户（通过 creator_id）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return SkillEntity 技能实体
     */
    public function findUserSkillByCode(SkillDataIsolation $dataIsolation, string $code): SkillEntity
    {
        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $code);
        if (! $skillEntity) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        if ($skillEntity->getCreatorId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_ACCESS_DENIED, 'skill.skill_access_denied');
        }

        return $skillEntity;
    }

    public function findSkillByCode(SkillDataIsolation $dataIsolation, string $code): SkillEntity
    {
        $skillEntity = $this->skillRepository->findByCode($dataIsolation, $code);
        if (! $skillEntity) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        return $skillEntity;
    }

    public function findOptionalSkillByCode(SkillDataIsolation $dataIsolation, string $code): ?SkillEntity
    {
        return $this->skillRepository->findByCode($dataIsolation, $code);
    }

    /**
     * 根据 code 列表批量查询技能.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $codes Skill code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 code
     */
    public function findSkillsByCodes(SkillDataIsolation $dataIsolation, array $codes): array
    {
        return $this->skillRepository->findByCodes($dataIsolation, $codes);
    }

    /**
     * 保存 Skill.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $entity Skill 实体
     */
    public function saveSkill(SkillDataIsolation $dataIsolation, SkillEntity $entity): SkillEntity
    {
        $entity->setSearchText(SkillMarketSearchTextBuilder::buildFromSkill($entity));
        return $this->skillRepository->save($dataIsolation, $entity);
    }

    /**
     * 根据 project_id 更新 Skill 的 updated_at 时间.
     */
    #[Transactional]
    public function updateUpdatedAtByProjectId(SkillDataIsolation $dataIsolation, int $projectId): bool
    {
        return $this->skillRepository->updateUpdatedAtByProjectId($dataIsolation, $projectId);
    }

    /**
     * Export agent workspace from sandbox to object storage.
     *
     * @param SkillDataIsolation $dataIsolation Data isolation context
     * @param string $code Agent code, e.g. "SMA-xxx"
     * @param int $projectId Associated project ID
     * @param string $fullWorkdir Full working directory path on object storage
     * @return array{file_key: string, metadata: array} Export result containing file_key and metadata
     */
    public function exportAgentFromSandbox(SkillDataIsolation $dataIsolation, string $code, int $projectId, string $fullWorkdir): array
    {
        // Build sandbox ID (same strategy as file converter)
        $sandboxId = WorkDirectoryUtil::generateUniqueCodeFromSnowflakeId($projectId . '_custom_agent');

        // Ensure sandbox is running
        $this->sandboxGateway->setUserContext($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());
        $this->sandboxGateway->ensureSandboxAvailable($sandboxId, (string) $projectId, $fullWorkdir);

        // Build upload_config: STS credentials for private bucket, matches sandbox API contract
        $uploadConfig = $this->cloudFileRepository->getStsTemporaryCredential(
            $dataIsolation->getCurrentOrganizationCode(),
            StorageBucketType::Private,
            '/skill_export',
            options: ['internal_endpoint' => true]
        );

        // Call sandbox workspace export API via proxy request
        $request = new ExportWorkspaceRequest(ProjectMode::CUSTOM_AGENT->value, $code, $uploadConfig);
        $response = $this->workspaceExporter->export($sandboxId, $request);

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'super_magic.skill.export_failed');
        }

        return $response->toArray();
    }

    /**
     * Import skill workspace archive from URL into sandbox workspace.
     * Sandbox initialization must be completed by the application layer before calling.
     *
     * @return array{workspace_dir: string, extracted_files: int}
     */
    public function importSkillWorkspaceFromSandbox(
        SkillDataIsolation $dataIsolation,
        string $sandboxId,
        string $fileUrl,
        string $targetDir = ''
    ): array {
        $this->sandboxGateway->setUserContext($dataIsolation->getCurrentUserId(), $dataIsolation->getCurrentOrganizationCode());

        $request = new ImportWorkspaceRequest($fileUrl, $targetDir);
        $response = $this->workspaceImporter->import($sandboxId, $request);

        if (! $response->isSuccess()) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, $response->getMessage());
        }

        return $response->toArray();
    }

    /**
     * 根据 ID 查找 Skill 版本（不进行组织过滤，用于查询公开的商店技能版本）.
     *
     * @param int $id 版本 ID
     */
    public function findSkillVersionByIdWithoutOrganizationFilter(int $id): ?SkillVersionEntity
    {
        return $this->skillVersionRepository->findByIdWithoutOrganizationFilter($id);
    }

    /**
     * Batch query skill versions without organization filter.
     *
     * @return array<int, SkillVersionEntity>
     */
    public function findSkillVersionsByIdsWithoutOrganizationFilter(array $ids): array
    {
        return $this->skillVersionRepository->findByIdsWithoutOrganizationFilter($ids);
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $skillIds Skill ID 列表
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        return $this->skillRepository->findByIds($dataIsolation, $skillIds);
    }

    /**
     * 根据 ID 列表批量查询技能详情.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $skillIds Skill ID 列表
     * @return array<int, SkillEntity> 技能实体数组，key 为 skill_id
     */
    public function findUserSkillsByIds(SkillDataIsolation $dataIsolation, array $skillIds): array
    {
        return $this->skillRepository->findUserSkillsByIds($dataIsolation, $skillIds);
    }

    /**
     * 根据 package_name 和 creator_id 查找用户已存在的技能（非store来源）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findSkillByPackageNameAndCreator(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        return $this->skillRepository->findByPackageNameAndCreator($dataIsolation, $packageName);
    }

    /**
     * 根据 package_name 查找用户组织下已存在的技能（所有来源类型）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $packageName Skill 包唯一标识名
     * @return null|SkillEntity 不存在返回 null
     */
    public function findSkillByPackageName(SkillDataIsolation $dataIsolation, string $packageName): ?SkillEntity
    {
        return $this->skillRepository->findByPackageName($dataIsolation, $packageName);
    }

    /**
     * 根据市场 skill_code 列表查询用户已添加的技能（用于判断 is_added 和 need_upgrade）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param array $versionCodes 市场 skill_code 列表
     * @return array<string, SkillEntity> 技能实体数组，key 为 skill_code
     */
    public function findByVersionCodes(SkillDataIsolation $dataIsolation, array $versionCodes): array
    {
        return $this->buildSkillEntitiesFromUserSkills(
            $this->userSkillRepository->findBySkillCodes($dataIsolation, $versionCodes)
        );
    }

    /**
     * 检查用户组织是否已添加该技能（通过 code 判断）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return bool 是否已添加
     */
    public function isSkillAdded(SkillDataIsolation $dataIsolation, string $code): bool
    {
        return $this->userSkillRepository->findBySkillCode($dataIsolation, $code) !== null;
    }

    public function findUserSkillOwnershipByCode(SkillDataIsolation $dataIsolation, string $code): ?UserSkillEntity
    {
        return $this->userSkillRepository->findBySkillCode($dataIsolation, $code);
    }

    /**
     * @return array<string>
     */
    public function findCurrentUserSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        return $this->userSkillRepository->findCurrentUserSkillCodes($dataIsolation);
    }

    /**
     * @return UserSkillEntity[]
     */
    public function findAllUserSkillOwnershipsByCode(SkillDataIsolation $dataIsolation, string $code): array
    {
        return $this->userSkillRepository->findAllBySkillCode($dataIsolation, $code);
    }

    /**
     * 查询用户技能列表（支持分页、关键词搜索、来源类型筛选）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{total: int, list: SkillEntity[]} 总数和技能实体数组
     */
    public function queries(
        SkillDataIsolation $dataIsolation,
        SkillQuery $query,
        Page $page
    ): array {
        return $this->skillRepository->queries($dataIsolation, $query, $page);
    }

    /**
     * Query visible local skills by visible skill codes.
     *
     * @param array<string> $codes
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queriesByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array {
        return $this->skillRepository->queriesByCodes($dataIsolation, $codes, $query, $page);
    }

    /**
     * Query shared skills by visible skill codes.
     *
     * @param array<string> $codes
     * @return array{total: int, list: SkillEntity[]}
     */
    public function queriesSharedByCodes(
        SkillDataIsolation $dataIsolation,
        array $codes,
        SkillQuery $query,
        Page $page
    ): array {
        return $this->skillRepository->queriesSharedByCodes($dataIsolation, $codes, $query, $page);
    }

    /**
     * @return array<string>
     */
    public function findCurrentUserSkillCodesBySourceType(
        SkillDataIsolation $dataIsolation,
        SkillSourceType|string $sourceType
    ): array {
        return $this->userSkillRepository->findSkillCodesBySourceType($dataIsolation, $sourceType);
    }

    /**
     * 查询用户技能总数（用于分页）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $keyword 关键词（搜索 name_i18n 和 description_i18n）
     * @param string $languageCode 语言代码（如 en_US, zh_CN）
     * @param string $sourceType 来源类型筛选（LOCAL_UPLOAD, STORE, GITHUB）
     * @return int 总记录数
     */
    public function countSkillList(
        SkillDataIsolation $dataIsolation,
        string $keyword,
        string $languageCode,
        string $sourceType
    ): int {
        return $this->skillRepository->countList($dataIsolation, $keyword, $languageCode, $sourceType);
    }

    /**
     * 删除 Skill（软删除）.
     * 删除前会将所有版本和市场技能标记为已下架.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Skill code
     * @return bool 是否删除成功
     */
    public function deleteSkill(SkillDataIsolation $dataIsolation, string $code): bool
    {
        Db::beginTransaction();
        try {
            $this->skillMarketDomainService->updateAllPublishStatusBySkillCode($code, PublishStatus::OFFLINE->value);
            $this->deleteAllUserSkillOwnershipsByCode($dataIsolation, $code);
            $this->skillVersionRepository->deleteByCode($dataIsolation, $code);

            $result = $this->skillRepository->deleteByCode($dataIsolation, $code);

            Db::commit();
            return $result;
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * Update skill basic information.
     *
     * @param SkillDataIsolation $dataIsolation Data isolation object
     * @param SkillEntity $skillEntity Skill entity
     * @param null|array $nameI18n Name in i18n format, optional
     * @param null|array $descriptionI18n Description in i18n format, optional
     * @param null|string $logo Logo URL, optional; empty string means clear
     * @return SkillEntity Updated skill entity
     */
    public function updateSkillInfo(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?array $sourceI18n = null,
        ?string $logo = null
    ): SkillEntity {
        if ($nameI18n !== null) {
            $skillEntity->setNameI18n($nameI18n);
        }
        if ($descriptionI18n !== null) {
            $skillEntity->setDescriptionI18n($descriptionI18n);
        }
        if ($sourceI18n !== null) {
            $skillEntity->setSourceI18n($sourceI18n);
        }
        if ($logo !== null) {
            $skillEntity->setLogo($logo === '' ? null : $logo);
        }

        return $this->skillRepository->save($dataIsolation, $skillEntity);
    }

    /**
     * Update skill version basic information.
     *
     * @param SkillDataIsolation $dataIsolation Data isolation object
     * @param SkillVersionEntity $versionEntity Skill version entity
     * @param null|array $nameI18n Name in i18n format, optional
     * @param null|array $descriptionI18n Description in i18n format, optional
     * @param null|string $logo Logo URL, optional; empty string means clear
     * @return SkillVersionEntity Updated skill version entity
     */
    public function updateSkillVersionInfo(
        SkillDataIsolation $dataIsolation,
        SkillVersionEntity $versionEntity,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?array $sourceI18n = null,
        ?string $logo = null
    ): SkillVersionEntity {
        if ($nameI18n !== null) {
            $versionEntity->setNameI18n($nameI18n);
        }
        if ($descriptionI18n !== null) {
            $versionEntity->setDescriptionI18n($descriptionI18n);
        }
        if ($sourceI18n !== null) {
            $versionEntity->setSourceI18n($sourceI18n);
        }
        if ($logo !== null) {
            $versionEntity->setLogo($logo === '' ? null : $logo);
        }

        return $this->skillVersionRepository->save($dataIsolation, $versionEntity);
    }

    /**
     * 从技能市场添加技能.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param int $storeSkillId 市场技能 ID
     * @return SkillEntity 创建的技能实体
     */
    public function addSkillFromMarket(SkillDataIsolation $dataIsolation, int $storeSkillId): SkillEntity
    {
        // 1. 查询商店技能信息（仅查询已发布的）
        $storeSkill = $this->skillMarketDomainService->findPublishedById($storeSkillId);
        if (! $storeSkill) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_NOT_FOUND, 'skill.store_skill_not_found');
        }

        // 2. 查询技能版本信息（获取完整信息，不进行组织过滤，因为商店技能是公开的）
        $skillVersion = $this->findSkillVersionByIdWithoutOrganizationFilter($storeSkill->getSkillVersionId());
        if (! $skillVersion) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_VERSION_NOT_FOUND, 'skill.skill_version_not_found');
        }

        if ($skillVersion->getCreatorId() === $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(
                SkillErrorCode::SKILL_CREATOR_CANNOT_ADD_FROM_MARKET,
                'skill.skill_creator_cannot_add_from_market'
            );
        }

        if ($skillVersion->getSourceType()->isSystem()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_ALREADY_ADDED, 'skill.store_skill_already_added');
        }

        // 3. 检查用户是否已添加该市场 skill_code
        $marketSkillCode = $storeSkill->getSkillCode();
        $userSkillsMap = $this->findByVersionCodes($dataIsolation, [$marketSkillCode]);
        if (isset($userSkillsMap[$marketSkillCode])) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_ALREADY_ADDED, 'skill.store_skill_already_added');
        }

        $userSkillEntity = new UserSkillEntity([
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'user_id' => $dataIsolation->getCurrentUserId(),
            'skill_code' => $storeSkill->getSkillCode(),
            'skill_version_id' => $storeSkill->getSkillVersionId(),
            'source_type' => SkillSourceType::MARKET->value,
            'source_id' => $storeSkill->getId(),
        ]);

        // 使用事务确保数据一致性
        Db::beginTransaction();
        try {
            $userSkillEntity = $this->saveUserSkillOwnership($dataIsolation, $userSkillEntity);

            // 更新商店技能的安装次数
            $this->skillMarketDomainService->incrementInstallCount($storeSkill->getId());

            Db::commit();
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        }

        $installedSkill = $this->buildSkillEntityFromUserSkill($userSkillEntity);
        if ($installedSkill === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        return $installedSkill;
    }

    public function saveUserSkillOwnership(SkillDataIsolation $dataIsolation, UserSkillEntity $entity): UserSkillEntity
    {
        return $this->userSkillRepository->save($dataIsolation, $entity);
    }

    public function deleteUserSkillOwnership(SkillDataIsolation $dataIsolation, string $code): bool
    {
        return $this->userSkillRepository->deleteBySkillCode($dataIsolation, $code);
    }

    public function deleteUserSkillOwnershipsExceptUser(SkillDataIsolation $dataIsolation, string $code, string $excludedUserId): int
    {
        return $this->userSkillRepository->deleteBySkillCodeExceptUser($dataIsolation, $code, $excludedUserId);
    }

    public function deleteAllUserSkillOwnershipsByCode(SkillDataIsolation $dataIsolation, string $code): int
    {
        return $this->userSkillRepository->deleteAllBySkillCode($dataIsolation, $code);
    }

    /**
     * Build a market-installed skill entity from a user-skill relation.
     */
    private function buildSkillEntityFromUserSkill(UserSkillEntity $userSkillEntity): ?SkillEntity
    {
        $entities = $this->buildSkillEntitiesFromUserSkills([$userSkillEntity->getSkillCode() => $userSkillEntity]);
        return $entities[$userSkillEntity->getSkillCode()] ?? null;
    }

    /**
     * Build skill entities from user-skill relations using separate repository queries.
     *
     * @param array<string, UserSkillEntity> $userSkillEntities
     * @return array<string, SkillEntity>
     */
    private function buildSkillEntitiesFromUserSkills(array $userSkillEntities): array
    {
        if ($userSkillEntities === []) {
            return [];
        }

        $marketIds = [];
        $versionIds = [];
        foreach ($userSkillEntities as $userSkillEntity) {
            if ($userSkillEntity->getSourceId() !== null) {
                $marketIds[] = $userSkillEntity->getSourceId();
            }
            if ($userSkillEntity->getSkillVersionId() !== null) {
                $versionIds[] = $userSkillEntity->getSkillVersionId();
            }
        }

        $marketMap = $this->skillMarketDomainService->findByIds(array_values(array_unique($marketIds)));
        $versionMap = $this->findSkillVersionsByIdsWithoutOrganizationFilter(array_values(array_unique($versionIds)));

        $result = [];
        foreach ($userSkillEntities as $skillCode => $userSkillEntity) {
            $marketSkill = $userSkillEntity->getSourceId() !== null ? ($marketMap[$userSkillEntity->getSourceId()] ?? null) : null;
            $skillVersion = $userSkillEntity->getSkillVersionId() !== null ? ($versionMap[$userSkillEntity->getSkillVersionId()] ?? null) : null;
            $skillEntity = $this->toSkillEntityFromUserSkill($userSkillEntity, $marketSkill, $skillVersion);
            if ($skillEntity !== null) {
                $result[$skillCode] = $skillEntity;
            }
        }

        return $result;
    }

    /**
     * Convert a user-skill relation into a skill entity.
     */
    private function toSkillEntityFromUserSkill(
        UserSkillEntity $userSkillEntity,
        ?SkillMarketEntity $marketSkill,
        ?SkillVersionEntity $skillVersion
    ): ?SkillEntity {
        if ($userSkillEntity->getSourceType()->isMarket()) {
            if ($marketSkill === null || $skillVersion === null) {
                return null;
            }

            return new SkillEntity([
                'id' => $userSkillEntity->getId(),
                'organization_code' => $userSkillEntity->getOrganizationCode(),
                'code' => $userSkillEntity->getSkillCode(),
                'creator_id' => $userSkillEntity->getUserId(),
                'package_name' => $skillVersion->getPackageName(),
                'package_description' => $skillVersion->getPackageDescription(),
                'name_i18n' => $marketSkill->getNameI18n() ?? $skillVersion->getNameI18n() ?? [],
                'description_i18n' => $marketSkill->getDescriptionI18n() ?? $skillVersion->getDescriptionI18n(),
                'source_i18n' => $skillVersion->getSourceI18n(),
                'logo' => $marketSkill->getLogo() ?? $skillVersion->getLogo(),
                'file_key' => $skillVersion->getFileKey(),
                'source_type' => $userSkillEntity->getSourceType()->value,
                'source_id' => $userSkillEntity->getSourceId(),
                'source_meta' => [
                    'store_skill_id' => $userSkillEntity->getSourceId(),
                    'skill_version_id' => $userSkillEntity->getSkillVersionId(),
                    'version_code' => $userSkillEntity->getSkillCode(),
                ],
                'version_id' => $userSkillEntity->getSkillVersionId(),
                'version_code' => $userSkillEntity->getSkillCode(),
                'is_enabled' => 1,
                'pinned_at' => null,
                'project_id' => null,
                'latest_published_at' => $skillVersion->getPublishedAt(),
                'created_at' => $userSkillEntity->getCreatedAt(),
                'updated_at' => $userSkillEntity->getUpdatedAt(),
            ]);
        }

        return null;
    }
}
