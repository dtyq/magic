<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Asset\Service;

use App\Application\Asset\Support\AssetVisualPrecheck;
use App\Application\Asset\Support\ProjectFileMaterializer;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\AssetTagNodeType;
use App\Domain\Asset\Entity\ValueObject\AssetVisibility;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\SaveAssetToLibraryRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdatePersonalAssetRequestDTO;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class AssetAppService extends AbstractAssetAppService
{
    public function __construct(
        private readonly AssetDomainService $assetDomainService,
        ResourceVisibilityDomainService $resourceVisibilityDomainService,
        private readonly ProjectFileMaterializer $projectFileMaterializer,
        private readonly AssetTagDomainService $assetTagDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly LoggerInterface $logger,
        private readonly AssetVisualPrecheck $visualPrecheck,
    ) {
        parent::__construct($resourceVisibilityDomainService);
    }

    public function createPersonalAsset(
        Authenticatable|BaseDataIsolation $authorization,
        CreateAssetRequestDTO $requestDTO,
        bool $synchronous = false,
    ): AssetEntity {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $contentHash = null;
        // 未传私有桶文件键时，从有权限的项目文件生成并补齐 file_key。
        if ($requestDTO->getAssetKind() === 'ASSET') {
            $contentHash = $this->materializeProjectFileIfNeeded($dataIsolation, $requestDTO);
        }
        $asset = $this->createAssetEntity($requestDTO, false, $dataIsolation->getCurrentOrganizationCode());
        // 素材只落在私有桶：创建前解析出 file_url 供第三方拉取；落库后的实体不含该字段，回填给响应。
        $this->resolveAssetFileUrls([$asset]);
        // 记录内容指纹：用于跨组织复用已经通过审核的第三方素材。
        $asset->setContentHash($contentHash ?? $this->resolveContentHash($asset));

        // 当前用户、当前组织内复用本地记录，避免刷新同一个 file_key 时重复创建副本
        if ($asset->getContentHash() !== null && $asset->getContentHash() !== '') {
            $existing = $this->assetDomainService->findPersonalAssetByContentHash($dataIsolation->getCurrentUserId(), $asset->getContentHash(), true);
            if ($existing !== null) {
                $this->resolveAssetFileUrls([$existing]);
                $providerAsset = $this->assetDomainService->findProviderAssets($dataIsolation, [(int) $existing->getId()])[(string) $existing->getId()] ?? null;
                if ($providerAsset === null || ! $providerAsset->getProviderStatus()->isPassed()) {
                    $this->assetDomainService->assertPersonalAssetQuota($dataIsolation);
                    $existingFileUrl = $existing->getFileUrl();
                    if ($synchronous) {
                        $this->assetDomainService->syncPersonalAsset(
                            $dataIsolation,
                            $existing->getId(),
                            $existingFileUrl,
                            $this->visualPrecheck->resolveReviewMode($dataIsolation, $existing, $existingFileUrl),
                        );
                    } else {
                        $this->dispatchPersonalAssetSync($dataIsolation, $existing, $existingFileUrl);
                    }
                }
                return $existing;
            }
        }

        if (! $asset->getAssetKind()->isGroup()) {
            $this->assetDomainService->assertPersonalAssetQuota($dataIsolation);
        }

        $fileUrl = $asset->getFileUrl();
        $asset = $this->assetDomainService->createPersonal($dataIsolation, $asset);
        $this->grantAssetVisibility($dataIsolation, $asset, AssetVisibility::personal());
        $dataIsolation->setContainOfficialOrganization(true);
        $this->assetTagDomainService->syncAssetTags($dataIsolation, $asset, $requestDTO->getTagIds());
        $asset->setFileUrl($fileUrl);
        if ($synchronous) {
            $this->assetDomainService->syncPersonalAsset(
                $dataIsolation,
                $asset->getId(),
                $fileUrl,
                $this->visualPrecheck->resolveReviewMode($dataIsolation, $asset, $fileUrl),
            );
        } else {
            $this->dispatchPersonalAssetSync($dataIsolation, $asset, $fileUrl);
        }
        return $asset;
    }

    /**
     * 保存到「我的素材库」：只落本地库、不做第三方合规同步，并按可见范围补授权记录。
     */
    public function saveToLibrary(
        Authenticatable|BaseDataIsolation $authorization,
        SaveAssetToLibraryRequestDTO $requestDTO,
    ): AssetEntity {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $contentHash = $this->materializeProjectFileIfNeeded($dataIsolation, $requestDTO);
        $asset = $this->createAssetEntity($requestDTO, false, $dataIsolation->getCurrentOrganizationCode());
        $asset->setVisibilityType($requestDTO->getVisibilityType());
        $asset->setVisibility($requestDTO->getVisibilityConfig());
        // 保存前必须确认文件存在且当前组织可以访问。
        $this->resolveAssetFileUrls([$asset]);
        if ($asset->getFileUrl() === null || $asset->getFileUrl() === '') {
            ExceptionBuilder::throw(AssetErrorCode::FILE_REQUIRED);
        }
        // 项目文件入口已带回指纹；只传 file_key 的入口在这里补齐，否则同一份内容无法命中已有审核结果。
        $asset->setContentHash($contentHash ?? $this->resolveContentHash($asset));
        $asset = $this->assetDomainService->saveToLibrary(
            $dataIsolation,
            $asset,
        );
        $this->grantAssetVisibility($dataIsolation, $asset, $requestDTO->getVisibility());
        $dataIsolation->setContainOfficialOrganization(true);
        $this->assetTagDomainService->syncAssetTags($dataIsolation, $asset, $requestDTO->getTagIds());
        // 落库实体不带 file_url，列表与详情都会回填，保存响应保持一致，前端拿到即可直接展示。
        $this->resolveAssetFileUrls([$asset]);

        return $asset;
    }

    public function signAgreement(Authenticatable|BaseDataIsolation $authorization): void
    {
        $this->assetDomainService->signAgreement(
            $this->createAssetDataIsolation($authorization),
        );
    }

    /** 返回当前用户在当前组织的素材协议签署状态。 */
    public function hasSignedAgreement(Authenticatable|BaseDataIsolation $authorization): bool
    {
        return $this->assetDomainService->hasSignedAgreement(
            $this->createAssetDataIsolation($authorization),
        );
    }

    public function findPersonalAssetByContentHash(string $userId, string $contentHash): ?AssetEntity
    {
        return $this->assetDomainService->findPersonalAssetByContentHash($userId, $contentHash);
    }

    /**
     * 查询可访问的本地资产并补齐第三方同步所需的临时文件地址。
     */
    public function prepareAssetForProviderSync(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): ?AssetEntity
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $assetId = (string) $assetId;
        $asset = $this->assetDomainService->find(
            $dataIsolation,
            $assetId,
            $this->sharedAssetIds($dataIsolation, [$assetId]) !== [],
        );
        if ($asset === null) {
            return null;
        }

        // 素材库保存时可能只有 file_key，第三方同步需要可访问的临时 file_url。
        $this->resolveAssetFileUrls([$asset]);
        return $asset;
    }

    /**
     * @return array{total: int, list: AssetEntity[], provider_assets: array<string, ProviderAssetEntity>}
     */
    public function list(
        Authenticatable|BaseDataIsolation $authorization,
        QueryAssetRequestDTO $requestDTO,
    ): array {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        if ($requestDTO->getScope() === AssetScope::PUBLIC) {
            $dataIsolation->setOnlyOfficialOrganization(true);
        }
        $page = new Page(
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
        );
        $result = $this->assetDomainService->queries(
            $dataIsolation,
            $this->createQuery($requestDTO, $dataIsolation),
            $page,
        );
        // 标签可能来自官方组织；资产范围查询完成后再扩展隔离范围，避免影响资产本身的列表边界。
        $dataIsolation->setContainOfficialOrganization(true);
        $this->enrichAssets($dataIsolation, $result['list'], $requestDTO->getScope()->value);
        $this->resolveAssetFileUrls($result['list']);
        $result['provider_assets'] = $this->providerAssetsByEntities($dataIsolation, $result['list']);
        return $result;
    }

    public function detail(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
    ): ?AssetEntity {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        // 团队分享的素材也要能打开详情，否则列表里点进去会拿不到数据。
        $granted = $this->sharedAssetIds($dataIsolation, [(string) $assetId]) !== [];
        $asset = $this->assetDomainService->find($dataIsolation, $assetId, $granted);
        if ($asset !== null) {
            $this->enrichAssets($dataIsolation, [$asset], $granted ? 'TEAM' : 'PERSONAL');
            $this->resolveAssetFileUrls([$asset]);
        }
        return $asset;
    }

    /** 编辑个人素材元数据；文件字段不从请求读取，也不会被修改。 */
    public function updatePersonalAsset(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
        UpdatePersonalAssetRequestDTO $requestDTO,
    ): AssetEntity {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $asset = $this->assetDomainService->find(
            $dataIsolation,
            $assetId,
            $this->sharedAssetIds($dataIsolation, [(string) $assetId]) !== [],
        );
        if ($asset === null || ! $asset->isOwnedBy(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        )) {
            ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
        }

        $updated = Db::transaction(function () use ($dataIsolation, $asset, $assetId, $requestDTO): AssetEntity {
            if ($requestDTO->getName() !== null) {
                $asset->setNameI18n(['default' => $requestDTO->getName()]);
            }
            if ($requestDTO->getDescription() !== null) {
                $asset->setDescriptionI18n(['default' => $requestDTO->getDescription()]);
            }
            if ($requestDTO->getVisibility() !== null) {
                $visibility = $requestDTO->getVisibility();
                $asset->setVisibilityType($requestDTO->getVisibilityType());
                $asset->setVisibility($requestDTO->getVisibilityConfig());
            }
            $asset->setTags($this->assetTagDomainService->findAssetTags($dataIsolation, $assetId));
            $updated = $this->assetDomainService->update($dataIsolation, $asset);
            if ($updated === null) {
                ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
            }

            // 元数据、可见范围和标签必须作为一次编辑提交；否则其中一项失败会让前端看到“保存成功”但范围仍是旧值。
            if ($requestDTO->getVisibility() !== null) {
                $visibility = $requestDTO->getVisibility();
                $this->resourceVisibilityDomainService->saveVisibilityByPrincipals(
                    $this->permissionDataIsolation($dataIsolation),
                    ResourceType::ASSET,
                    (string) $assetId,
                    VisibilityType::SPECIFIC,
                    array_values(array_unique([
                        $dataIsolation->getCurrentUserId(),
                        ...array_map('strval', (array) ($visibility['user_ids'] ?? [])),
                    ])),
                    array_values(array_map('strval', (array) ($visibility['department_ids'] ?? []))),
                );
            }
            if ($requestDTO->getTagIds() !== null) {
                $this->assetTagDomainService->syncAssetTags($dataIsolation, $updated, $requestDTO->getTagIds());
            }
            return $updated;
        });
        $this->resolveAssetFileUrls([$updated]);
        return $updated;
    }

    /** @param array<int, int|string> $assetIds @return AssetEntity[] */
    public function findByIds(Authenticatable|BaseDataIsolation $authorization, array $assetIds): array
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        $assetIds = array_values(array_unique(array_map('strval', $assetIds)));
        $assets = $this->assetDomainService->findByIds(
            $dataIsolation,
            $assetIds,
            $this->sharedAssetIds($dataIsolation, $assetIds),
        );
        $this->enrichAssets($dataIsolation, $assets, AssetScope::ALL->value);
        $this->resolveAssetFileUrls($assets);
        return $assets;
    }

    public function providerAsset(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): ?ProviderAssetEntity
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        return $this->assetDomainService->findProviderAssets($dataIsolation, [$assetId])[(string) $assetId] ?? null;
    }

    /** @param array<int, int|string> $assetIds @return array<string, ProviderAssetEntity> */
    public function findProviderAssets(Authenticatable|BaseDataIsolation $authorization, array $assetIds): array
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $dataIsolation->setContainOfficialOrganization(true);
        return $this->assetDomainService->findProviderAssets($dataIsolation, $assetIds);
    }

    public function compliance(Authenticatable|BaseDataIsolation $authorization, int|string $assetId): ?ProviderAssetEntity
    {
        return $this->assetDomainService->getComplianceStatus(
            $this->createAssetDataIsolation($authorization),
            $assetId,
        );
    }

    /** @param array<int, int|string> $assetIds @return array<int, array{asset_id: string, compliance_status: string, compliance_failed_reason: ?string}> */
    public function batchCompliance(Authenticatable|BaseDataIsolation $authorization, array $assetIds): array
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        // 素材与第三方映射各查一次，结果按素材主键索引后再按入参顺序组装，避免按 ID 逐个查询。
        $statuses = $this->assetDomainService->getComplianceStatuses($dataIsolation, $assetIds);

        $items = [];
        foreach ($assetIds as $assetId) {
            $providerAsset = $statuses[(string) $assetId] ?? null;
            $items[] = [
                'asset_id' => (string) $assetId,
                'compliance_status' => ($providerAsset?->getProviderStatus() ?? ProviderAssetStatus::UNVERIFIED)->value,
                'compliance_failed_reason' => $providerAsset?->getProviderFailedReason(),
            ];
        }
        return $items;
    }

    public function deletePersonalAsset(
        Authenticatable|BaseDataIsolation $authorization,
        int|string $assetId,
    ): bool {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $deleted = $this->assetDomainService->deletePersonal($dataIsolation, $assetId);
        if ($deleted) {
            // 资产行已删除，授权记录不能悬空，否则权限台会显示一条指向不存在资产的授权。
            // 素材可能已分享给其他用户/部门，按主体撤销会漏掉别人，这里按资源整体清理。
            $this->clearAssetVisibility($dataIsolation, $assetId);
        }
        return $deleted;
    }

    /** @param array<int, int|string> $assetIds @return array<int, string> */
    public function batchDeletePersonalAssets(Authenticatable|BaseDataIsolation $authorization, array $assetIds): array
    {
        $dataIsolation = $this->createAssetDataIsolation($authorization);
        $deletedIds = $this->assetDomainService->deletePersonalBatch($dataIsolation, $assetIds);
        foreach ($deletedIds as $assetId) {
            // 资产行已删除，授权记录不能悬空：按资源整体清理，避免其他用户/部门的分享记录残留。
            $this->clearAssetVisibility($dataIsolation, $assetId);
        }
        return $deletedIds;
    }

    /** @return AssetTagEntity[] */
    public function listTags(Authenticatable|BaseDataIsolation $authorization): array
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        $isolation->setContainOfficialOrganization(true);
        // 用户侧只看通用素材的标签；其它业务类型（如头像库）的标签不在素材库筛选里出现。
        return $this->assetTagDomainService->listVisible($isolation, AssetTagEntity::DEFAULT_BUSINESS_TYPE);
    }

    public function saveTag(Authenticatable|BaseDataIsolation $authorization, string $name, string $nodeType, int $parentId = 0): AssetTagEntity
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        return $this->assetTagDomainService->create($isolation, $name, AssetTagNodeType::from($nodeType), $parentId);
    }

    public function updateTag(Authenticatable|BaseDataIsolation $authorization, int|string $id, string $name, string $nodeType, int $parentId = 0): AssetTagEntity
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        return $this->assetTagDomainService->update($isolation, $id, $name, AssetTagNodeType::from($nodeType), $parentId);
    }

    public function deleteTag(Authenticatable|BaseDataIsolation $authorization, int|string $id): void
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        $this->assetTagDomainService->delete($isolation, $id);
    }

    public function syncAssetTags(Authenticatable|BaseDataIsolation $authorization, int|string $assetId, array $tagIds): void
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        $isolation->setContainOfficialOrganization(true);
        $asset = $this->assetDomainService->find($isolation, $assetId, $this->sharedAssetIds($isolation, [(string) $assetId]) !== []);
        if ($asset === null || ($asset->getOwnerUid() ?: $asset->getUserId()) !== $isolation->getCurrentUserId()) {
            ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
        }
        $this->assetTagDomainService->syncAssetTags($isolation, $asset, $tagIds);
    }

    public function listOwners(Authenticatable|BaseDataIsolation $authorization): array
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        $assetIds = $this->sharedAssetIds($isolation);
        if ($assetIds === []) {
            return [];
        }
        $ownerUids = array_values(array_diff(
            $this->assetDomainService->findOwnerUidsByIds($isolation, $assetIds),
            [$isolation->getCurrentUserId()],
        ));
        if ($ownerUids === []) {
            return [];
        }
        $users = $this->userDomainService->getUserByIdsInOrganization(
            $ownerUids,
            $isolation->getCurrentOrganizationCode(),
        );
        return array_map(static fn ($user): array => [
            'id' => $user->getUserId(),
            'name' => $user->getNickname(),
        ], $users);
    }

    public function transferOwner(Authenticatable|BaseDataIsolation $authorization, array $assetIds, string $ownerUid): array
    {
        $isolation = $this->createAssetDataIsolation($authorization);
        $ownerUid = trim($ownerUid);
        if ($ownerUid === '' || $ownerUid === $isolation->getCurrentUserId() || $this->userDomainService->getUserByIdsInOrganization([$ownerUid], $isolation->getCurrentOrganizationCode()) === []) {
            ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
        }
        $assets = [];
        foreach ($this->assetDomainService->transferOwner($isolation, $assetIds, $ownerUid) as $asset) {
            $this->assetTagDomainService->stripPersonalTagsForTransfer($isolation, $asset);
            $assets[] = $asset;
        }
        Db::transaction(function () use ($isolation, $assets, $ownerUid): void {
            $permissionIsolation = $this->permissionDataIsolation($isolation);
            foreach ($assets as $asset) {
                $code = (string) $asset->getId();
                $this->resourceVisibilityDomainService->deleteResourceVisibilityByPrincipals(
                    $permissionIsolation,
                    ResourceType::ASSET,
                    $code,
                    PrincipalType::USER,
                    [$isolation->getCurrentUserId()],
                );
                $this->resourceVisibilityDomainService->addResourceVisibilityByPrincipalsIfMissing(
                    $permissionIsolation,
                    ResourceType::ASSET,
                    $code,
                    PrincipalType::USER,
                    [$ownerUid],
                );
            }
        });
        return ['changed_num' => count($assets), 'owner_uid' => $ownerUid];
    }

    /** 未提供 file_key 时，从项目文件生成私有桶文件并返回已计算的内容哈希。 */
    private function materializeProjectFileIfNeeded(AssetDataIsolation $dataIsolation, CreateAssetRequestDTO $requestDTO): ?string
    {
        if (trim((string) $requestDTO->getFileKey()) !== '') {
            return null;
        }
        $projectId = $requestDTO->getProjectId();
        $projectFilePath = $requestDTO->getProjectFilePath();
        if ($projectId === null || $projectFilePath === null) {
            ExceptionBuilder::throw(AssetErrorCode::FILE_REQUIRED);
        }
        $materialized = $this->projectFileMaterializer->materialize($dataIsolation, $projectId, $projectFilePath);
        if ($materialized === null || ($materialized['file_key'] ?? '') === '') {
            ExceptionBuilder::throw(AssetErrorCode::FILE_REQUIRED);
        }
        $requestDTO->setFileKey($materialized['file_key']);
        return $materialized['content_hash'] ?? null;
    }

    private function dispatchPersonalAssetSync(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        ?string $fileUrl,
    ): void {
        if ($asset->getAssetKind()->isGroup() || $asset->getId() === null) {
            return;
        }

        $assetId = $asset->getId();
        // 先落 Provider 初始状态，再启动协程，保证前端立即轮询时至少得到 PROCESSING。
        $this->assetDomainService->ensureProviderAssetProcessing($dataIsolation, $assetId);
        $coroutineId = Coroutine::id();
        Coroutine::create(function () use ($dataIsolation, $assetId, $fileUrl, $coroutineId): void {
            CoContext::copy($coroutineId);
            try {
                $asset = $this->assetDomainService->find($dataIsolation, $assetId, true);
                if ($asset === null) {
                    return;
                }
                $this->assetDomainService->syncPersonalAsset(
                    $dataIsolation,
                    $assetId,
                    $fileUrl,
                    $this->visualPrecheck->resolveReviewMode($dataIsolation, $asset, $fileUrl),
                );
            } catch (Throwable $throwable) {
                $this->logger->error('个人素材异步同步失败', [
                    'asset_id' => $assetId,
                    'exception' => $throwable::class,
                    'message' => $throwable->getMessage(),
                ]);
            }
        });
    }

    /**
     * 组装列表查询条件；团队分享与全部范围需要先解析出已授权给当前用户的资产主键。
     */
    private function createQuery(QueryAssetRequestDTO $requestDTO, AssetDataIsolation $dataIsolation): AssetQuery
    {
        $query = new AssetQuery();
        $scope = $requestDTO->getScope();
        $query->setScope($scope);
        $sharedAssetIds = $scope->includesSharedAssets() ? $this->sharedAssetIds($dataIsolation) : [];
        $query->setSharedAssetIds($sharedAssetIds);
        $query->setAssetKind($requestDTO->getAssetKind());
        $query->setParentId($requestDTO->getParentId());
        $query->setAssetBusinessType($requestDTO->getAssetBusinessType());
        $query->setAssetMediaType($requestDTO->getAssetMediaType());
        $query->setKeyword($requestDTO->getKeyword());
        $query->setStatus($requestDTO->getStatus() ?? 1);
        $query->setComplianceStatus($requestDTO->getComplianceStatus());
        $query->setOwnerUids($requestDTO->getOwnerUids());
        $query->setTagIds($requestDTO->getTagIds());
        $query->setTagMatch($requestDTO->getTagMatch());
        return $query;
    }

    private function enrichAssets(AssetDataIsolation $isolation, array $assets, string $scope): void
    {
        // 标签名与标签树接口（AssetAssembler）同一口径：优先当前语言，缺失回退 default。
        $language = $isolation->getLanguage();
        $tagsByAsset = $this->assetTagDomainService->findTagsByAssetIds(
            $isolation,
            array_values(array_filter(array_map(
                static fn (AssetEntity $asset): ?int => $asset->getId(),
                $assets,
            ))),
        );
        $ownerIds = [];
        foreach ($assets as $asset) {
            $ownerId = $asset->getOwnerUid() ?: $asset->getUserId();
            if ($ownerId !== null) {
                $ownerIds[] = $ownerId;
            }
            $asset->setSource($ownerId === $isolation->getCurrentUserId()
                ? 'PERSONAL'
                : ($asset->isOfficial($isolation->getOfficialOrganizationCodes()) ? 'PUBLIC' : 'TEAM'));
            $asset->setTags(array_map(static fn (AssetTagEntity $tag): array => [
                'id' => (string) $tag->getId(),
                'name' => $tag->getI18nName($language),
            ], $tagsByAsset[(string) $asset->getId()] ?? []));
        }
        $infos = [];
        foreach ($this->userDomainService->getUserByIdsInOrganization(array_values(array_unique($ownerIds)), $isolation->getCurrentOrganizationCode()) as $user) {
            $infos[$user->getUserId()] = ['nickname' => $user->getNickname()];
        }
        foreach ($assets as $asset) {
            $ownerId = $asset->getOwnerUid() ?: $asset->getUserId();
            $info = $infos[$ownerId] ?? [];
            $asset->setOwnerName((string) ($info['nickname'] ?? ''));
        }
    }

    /** @param AssetEntity[] $assets @return array<string, ProviderAssetEntity> */
    private function providerAssetsByEntities(AssetDataIsolation $dataIsolation, array $assets): array
    {
        return $this->assetDomainService->findProviderAssets(
            $dataIsolation,
            array_values(array_filter(array_map(
                static fn (AssetEntity $asset): ?int => $asset->getId(),
                $assets,
            ))),
        );
    }
}
