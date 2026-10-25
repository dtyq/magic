<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Service;

use App\Domain\Asset\Contract\AssetProviderInterface;
use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Repository\Facade\AssetAgreementRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetProviderAssetRepositoryInterface;
use App\Domain\Asset\Repository\Facade\AssetRepositoryInterface;
use App\Domain\Asset\Repository\Persistence\Model\AssetProviderAssetModel;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\ExternalAPI\VolcengineArk\Assets\VolcengineArkAssetProvider;
use Hyperf\Context\Context;
use Hyperf\Coroutine\Coroutine;
use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * 资产领域服务：先落库取得主键，再同步第三方，确保凭证可追溯。
 * 素材组仅保留本地层级；每个素材在第三方使用独立素材组。
 */
class AssetDomainService
{
    /**
     * 协程内缓存的第三方素材上下文：适配器实例 + 由同一份配置派生的项目名。
     */
    public const string PROVIDER_CONTEXT_KEY = 'asset_provider_context:volcengine_ark_assets';

    /** 第三方合规轮询的最长等待时间。 */
    private const int COMPLIANCE_TIMEOUT_SECONDS = 300;

    /** 第三方项目名缺省值。 */
    private const string DEFAULT_PROJECT_NAME = 'default';

    /** 第三方合规状态轮询间隔。 */
    private const float COMPLIANCE_POLL_INTERVAL_SECONDS = 1.0;

    /** 同步失败原因的最大存储长度。 */
    private const int FAILED_REASON_MAX_LENGTH = 512;

    public function __construct(
        private readonly AssetRepositoryInterface $assets,
        private readonly AssetProviderAssetRepositoryInterface $providerAssets,
        private readonly AssetAgreementRepositoryInterface $agreements,
        private readonly LoggerInterface $logger,
        private readonly AiAbilityDomainService $abilityDomainService,
        private readonly AssetSearchTextBuilder $searchTextBuilder,
    ) {
    }

    public function createPersonal(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        if (! $this->agreements->hasAccepted($dataIsolation)) {
            ExceptionBuilder::throw(AssetErrorCode::AGREEMENT_REQUIRED);
        }
        $asset->setUserId($dataIsolation->getCurrentUserId());
        $this->assertParentGroupExists($dataIsolation, $asset);
        $saved = $this->saveLocal($dataIsolation, $asset);
        if (! $saved->getAssetKind()->isGroup()) {
            $this->markProviderStatus($dataIsolation, $saved, ProviderAssetStatus::UNVERIFIED);
        }
        return $saved;
    }

    /**
     * 保存到「我的素材库」：只落本地库，不创建 Provider 映射。
     *
     * 与 createPersonal 的区别：不校验素材协议、不做第三方合规同步（无凭证、无轮询），
     * 因此落库即为终态，立即可对外展示。
     */
    public function saveToLibrary(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        $asset->setUserId($dataIsolation->getCurrentUserId());
        return $this->saveLocal($dataIsolation, $asset);
    }

    public function signAgreement(AssetDataIsolation $dataIsolation): void
    {
        if ($this->agreements->hasAccepted($dataIsolation)) {
            return;
        }
        $this->agreements->markAccepted($dataIsolation);
    }

    public function hasSignedAgreement(AssetDataIsolation $dataIsolation): bool
    {
        return $this->agreements->hasAccepted($dataIsolation);
    }

    public function createPublic(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        $asset->setUserId(null);
        return $this->create($dataIsolation, $asset);
    }

    /**
     * 创建只落本地的公开资产：不向第三方注册、不做合规审核。
     *
     * | 方法                    | 本地落库 | 第三方素材注册与合规 |
     * | createPublic            | 是       | 是                   |
     * | createPublicLocalOnly   | 是       | 否                   |
     *
     * 用于平台自行生成、自行管理的素材（如人设头像库），它们没有第三方审核的需要。
     */
    public function createPublicLocalOnly(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        $asset->setUserId(null);
        $this->assertParentGroupExists($dataIsolation, $asset);
        return $this->saveLocal($dataIsolation, $asset);
    }

    /**
     * 删除本人创建的资产。
     *
     * 团队分享等他人创建的素材不归本人处置，直接拒绝；不可见/不存在的资产按不存在返回，
     * 避免通过删除接口探测别人资产是否存在。
     */
    public function deletePersonal(AssetDataIsolation $dataIsolation, int|string $assetId): bool
    {
        $existing = $this->assets->findById($dataIsolation, $assetId);
        if ($existing === null) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        if (! $existing->isOwnedBy($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId())) {
            ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
        }
        return $this->deleteAssetWithProvider($dataIsolation, $existing);
    }

    /** @param array<int, int|string> $assetIds @return array<int, string> */
    public function deletePersonalBatch(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        $normalizedIds = array_values(array_unique(array_map('strval', $assetIds)));
        $assets = [];
        foreach ($normalizedIds as $assetId) {
            $asset = $this->assets->findById($dataIsolation, $assetId);
            if ($asset === null) {
                ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
            }
            if (! $asset->isOwnedBy($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId())) {
                ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
            }
            $assets[] = $asset;
        }

        $deletedIds = [];
        foreach ($assets as $asset) {
            if ($this->deleteAssetWithProvider($dataIsolation, $asset)) {
                $deletedIds[] = (string) $asset->getId();
            }
        }
        return $deletedIds;
    }

    /** @param array<int, int|string> $assetIds @return AssetEntity[] */
    public function transferOwner(AssetDataIsolation $dataIsolation, array $assetIds, string $ownerUid): array
    {
        $assetIds = array_values(array_unique(array_map('strval', $assetIds)));
        if ($assetIds === []) {
            return [];
        }
        $assets = [];
        foreach ($assetIds as $assetId) {
            $asset = $this->assets->findById($dataIsolation, $assetId);
            if ($asset === null || ! $asset->isOwnedBy($dataIsolation->getCurrentOrganizationCode(), $dataIsolation->getCurrentUserId())) {
                ExceptionBuilder::throw(AssetErrorCode::DELETE_DENIED);
            }
            $asset->setOwnerUid($ownerUid);
            $assets[] = $asset;
        }
        Db::transaction(function () use ($dataIsolation, $assets, $ownerUid): void {
            $this->assets->batchUpdateOwner(
                $dataIsolation,
                array_map(static fn (AssetEntity $asset): ?int => $asset->getId(), $assets),
                $ownerUid,
            );
        });
        return $assets;
    }

    /** @return array<string> */
    public function findOwnerUidsByIds(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        return $this->assets->findOwnerUidsByIds($dataIsolation, $assetIds);
    }

    public function deletePublic(AssetDataIsolation $dataIsolation, int|string $assetId): bool
    {
        $existing = $this->assets->findById($dataIsolation, $assetId);
        if ($existing === null || $existing->getUserId() !== null) {
            return false;
        }
        return $this->deleteAssetWithProvider($dataIsolation, $existing);
    }

    public function update(AssetDataIsolation $dataIsolation, AssetEntity $asset): ?AssetEntity
    {
        return $this->updateAttributes($dataIsolation, $asset);
    }

    public function updatePublic(AssetDataIsolation $dataIsolation, AssetEntity $asset): ?AssetEntity
    {
        if ($asset->getId() === null) {
            return null;
        }
        $existing = $this->assets->findById($dataIsolation, $asset->getId());
        if ($existing === null || $existing->getUserId() !== null) {
            return null;
        }
        return $this->updateAttributes($dataIsolation, $asset);
    }

    /**
     * 单个资产对当前用户可见性判定。
     *
     * $granted 表示可见性授权已确认当前用户（本人、其所属部门或本组织）在范围内——
     * 这类「团队分享」素材同样允许查看详情，否则列表里点进去会拿不到数据。
     */
    public function find(AssetDataIsolation $dataIsolation, int|string $assetId, bool $granted = false): ?AssetEntity
    {
        $existing = $this->assets->findById($dataIsolation, $assetId);
        if ($existing === null) {
            return null;
        }
        if ($granted) {
            return $existing;
        }
        $isPersonal = $existing->isOwnedBy(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        );
        $isOfficial = $existing->isOfficial($dataIsolation->getOfficialOrganizationCodes())
            && $existing->getStatus()->isEnabled();
        return $isPersonal || $isOfficial ? $existing : null;
    }

    /** @param array<int, int|string> $assetIds @param array<string> $sharedAssetIds @return AssetEntity[] */
    public function findByIds(
        AssetDataIsolation $dataIsolation,
        array $assetIds,
        array $sharedAssetIds = [],
    ): array {
        $sharedAssetIds = array_map('strval', $sharedAssetIds);
        $assets = $this->assets->findByIds($dataIsolation, $assetIds);
        $accessible = [];
        foreach ($assets as $asset) {
            $assetId = (string) $asset->getId();
            $isPersonal = $asset->isOwnedBy(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            );
            $isOfficial = $asset->isOfficial($dataIsolation->getOfficialOrganizationCodes())
                && $asset->getStatus()->isEnabled();
            if ($isPersonal || $isOfficial || in_array($assetId, $sharedAssetIds, true)) {
                $accessible[$assetId] = $asset;
            }
        }

        $ordered = [];
        foreach ($assetIds as $assetId) {
            $asset = $accessible[(string) $assetId] ?? null;
            if ($asset !== null) {
                $ordered[(string) $assetId] = $asset;
            }
        }
        return array_values($ordered);
    }

    public function findPublic(AssetDataIsolation $dataIsolation, int|string $assetId): ?AssetEntity
    {
        $existing = $this->assets->findById($dataIsolation, $assetId);
        return $existing !== null && $existing->getUserId() === null ? $existing : null;
    }

    /** 查当前用户自己的同内容资产。 */
    public function findPersonalAssetByContentHash(string $userId, string $contentHash, bool $anySyncStatus = false): ?AssetEntity
    {
        return $this->assets->findPersonalAssetByContentHash($userId, $contentHash, $anySyncStatus);
    }

    /**
     * 取素材在第三方服务商侧的素材 ID（provider_asset_id）。
     *
     * asset:// URI 会被网关原样透传给服务商，而服务商只认它自己颁发的素材 ID，
     * 因此材质化改写时必须使用 provider_asset_id，不能用本地 magic_assets 主键。
     */
    public function findProviderAssetId(AssetDataIsolation $dataIsolation, int|string $assetId): ?string
    {
        $mapping = $this->providerAssets->findMapping(
            $dataIsolation,
            $assetId,
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        if ($mapping === null) {
            return null;
        }
        // 只有 Provider 已通过审核时才允许生成链路使用。
        $providerAsset = new ProviderAssetEntity($mapping->toArray());
        if (! $providerAsset->getProviderStatus()->isPassed()) {
            return null;
        }
        $providerAssetId = $providerAsset->getProviderAssetId();
        return $providerAssetId === '' ? null : $providerAssetId;
    }

    public function findProviderAsset(AssetDataIsolation $dataIsolation, int|string $assetId): ?ProviderAssetEntity
    {
        $mapping = $this->providerAssets->findMapping(
            $dataIsolation,
            $assetId,
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        if ($mapping === null) {
            return null;
        }
        // 只有 Provider 已通过审核时才允许生成链路使用。
        return new ProviderAssetEntity($mapping->toArray());
    }

    public function ensureProviderAssetId(AssetDataIsolation $dataIsolation, AssetEntity $asset): ?string
    {
        if ($asset->getAssetKind()->isGroup() || $asset->getId() === null) {
            return null;
        }
        $providerAssetId = $this->findProviderAssetId($dataIsolation, $asset->getId());
        if ($providerAssetId !== null) {
            return $providerAssetId;
        }
        $mapping = $this->syncPersonalAsset($dataIsolation, $asset->getId(), $asset->getFileUrl());
        return $mapping->getProviderStatus()->isPassed() && $mapping->getProviderAssetId() !== ''
            ? $mapping->getProviderAssetId()
            : null;
    }

    /**
     * 按内容指纹取一条已通过审核的凭证，供生成链路拼 asset:// 复用。
     */
    public function findPassedProviderAssetByContentHash(
        string $contentHash,
        string $organizationCode = '',
        string $userId = '',
    ): ?ProviderAssetEntity {
        return $this->providerAssets->findPassedMappingByContentHash(
            $contentHash,
            VolcengineArkAssetProvider::PROVIDER_CODE,
            $organizationCode,
            $userId,
        );
    }

    /**
     * @return array{total: int, list: AssetEntity[]}
     */
    public function queries(AssetDataIsolation $dataIsolation, AssetQuery $query, Page $page): array
    {
        return $this->assets->queries($dataIsolation, $query, $page);
    }

    public function assertPersonalAssetQuota(AssetDataIsolation $dataIsolation): void
    {
        $limit = $dataIsolation->getSubscriptionManager()->getPersonalArkAssetIdLimit();
        if ($limit === null) {
            return;
        }

        $used = $this->providerAssets->countPassedAssetsByUser(
            $dataIsolation->getCurrentUserId(),
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        if ($used >= $limit) {
            ExceptionBuilder::throw(
                AssetErrorCode::PERSONAL_ASSET_QUOTA_EXCEEDED,
                '',
                ['limit' => $limit],
            );
        }
    }

    /**
     * 异步同步当前用户的个人素材到默认 Provider。
     *
     * @param ProviderReviewMode $reviewMode 调用方对素材的预检结论
     */
    public function syncPersonalAsset(
        AssetDataIsolation $dataIsolation,
        int|string $assetId,
        ?string $fileUrl,
        ProviderReviewMode $reviewMode = ProviderReviewMode::VOLCENGINE,
    ): ProviderAssetEntity {
        $asset = $this->assets->findById($dataIsolation, $assetId);
        if ($asset === null || ! $asset->isOwnedBy(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        )) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        $mapping = $this->providerAssets->findMapping(
            $dataIsolation,
            $assetId,
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        if ($mapping !== null) {
            $providerAsset = new ProviderAssetEntity($mapping->toArray());
            if ($providerAsset->getProviderStatus()->isPassed() && $providerAsset->getProviderAssetId() !== '') {
                return $providerAsset;
            }
        }
        try {
            $this->assertPersonalAssetQuota($dataIsolation);
        } catch (BusinessException $exception) {
            // 异步任务可能在落库后才触达配额上限，不能让预先写入的 PROCESSING 状态一直悬挂。
            $this->markProviderStatus(
                $dataIsolation,
                $asset,
                ProviderAssetStatus::FAILED,
                $exception->getMessage(),
            );
            throw $exception;
        }
        $asset->setFileUrl($fileUrl);
        return $this->syncToProvider($dataIsolation, $asset, $reviewMode);
    }

    /**
     * 在启动异步同步前建立可轮询的初始映射。
     *
     * 普通创建接口明确表示“正在处理”，因此协程尚未开始时也必须返回 PROCESSING；
     * UNVERIFIED 仅用于保存到素材库、尚未发起第三方校验的素材。
     */
    public function ensureProviderAssetProcessing(
        AssetDataIsolation $dataIsolation,
        int|string $assetId,
    ): ProviderAssetEntity {
        $asset = $this->assets->findById($dataIsolation, $assetId);
        if ($asset === null || ! $asset->isOwnedBy(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId(),
        )) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        return $this->markProviderStatus($dataIsolation, $asset, ProviderAssetStatus::PROCESSING);
    }

    /**
     * @param array<int, int|string> $assetIds
     * @return array<string, ProviderAssetEntity>
     */
    public function findProviderAssets(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        return $this->providerAssets->findMappings(
            $dataIsolation,
            $assetIds,
            VolcengineArkAssetProvider::PROVIDER_CODE,
            $this->projectName(),
        );
    }

    public function getComplianceStatus(
        AssetDataIsolation $dataIsolation,
        int|string $assetId,
    ): ?ProviderAssetEntity {
        return $this->getComplianceStatuses($dataIsolation, [$assetId])[(string) $assetId] ?? null;
    }

    /**
     * 批量查询合规状态：素材和第三方映射各查一次，供批量接口使用。
     *
     * @param array<int, int|string> $assetIds
     * @return array<string, ?ProviderAssetEntity>
     */
    public function getComplianceStatuses(AssetDataIsolation $dataIsolation, array $assetIds): array
    {
        $assetIds = array_values(array_unique(array_filter(
            array_map(static fn (mixed $assetId): string => (string) $assetId, $assetIds),
            static fn (string $assetId): bool => $assetId !== '',
        )));
        if ($assetIds === []) {
            return [];
        }

        $assets = [];
        foreach ($this->assets->findByIds($dataIsolation, $assetIds) as $asset) {
            $assets[(string) $asset->getId()] = $asset;
        }
        // 先整体校验归属再查映射：入参里有不属于当前用户的素材时，不白查一次映射表。
        foreach ($assetIds as $assetId) {
            $asset = $assets[$assetId] ?? null;
            if ($asset === null || ! $asset->isOwnedBy(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            )) {
                ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
            }
        }

        $mappings = $this->providerAssets->findMappingModels(
            $dataIsolation,
            $assetIds,
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );

        $statuses = [];
        foreach ($assetIds as $assetId) {
            $mapping = $mappings[$assetId] ?? null;
            if ($mapping === null) {
                $statuses[$assetId] = null;
                continue;
            }
            $providerAsset = new ProviderAssetEntity($mapping->toArray());
            if ($providerAsset->getProviderStatus()->isProcessing() && $this->isComplianceExpired((string) $mapping->updated_at)) {
                $statuses[$assetId] = $this->markProviderStatus(
                    $dataIsolation,
                    $assets[$assetId],
                    ProviderAssetStatus::FAILED,
                    trans('asset.compliance_timeout'),
                    null,
                    $mapping,
                );
                continue;
            }
            $statuses[$assetId] = $providerAsset;
        }
        return $statuses;
    }

    /**
     * 统计第三方侧实际占用的素材与素材组数量，用于核对配额消耗。
     *
     * @return array{assets: int, groups: int}
     */
    public function countProviderResourceUsage(): array
    {
        return $this->providerAssets->countProviderResourceUsage($this->provider()->getProviderCode());
    }

    /**
     * 返回合规轮询等待上限。
     */
    protected function complianceTimeoutSeconds(): int
    {
        return self::COMPLIANCE_TIMEOUT_SECONDS;
    }

    /** 构造第三方服务商实现；抽成可覆写方法供单测替换适配器。 */
    protected function createAssetProvider(array $providerConfig): AssetProviderInterface
    {
        return new VolcengineArkAssetProvider($this->logger, $providerConfig);
    }

    /**
     * 判断合规轮询是否超时。
     */
    protected function isComplianceWaitExpired(float $deadline): bool
    {
        return microtime(true) >= $deadline;
    }

    /**
     * 等待下一次合规状态轮询。
     */
    protected function waitBeforeNextCompliancePoll(): void
    {
        Coroutine::sleep(self::COMPLIANCE_POLL_INTERVAL_SECONDS);
    }

    /**
     * 删除一个资产，并在无引用时回收第三方资源。
     *
     * 素材组只有本地层级（没有第三方资源），但删之前必须确认它已空，
     * 否则组下的子素材会落成找不到父级的孤儿记录。
     *
     * 素材：软删本地行之后再看「同一份第三方素材/素材组」是否还被别的本地素材引用。
     * 还有人引用就只删本地、保留远程（共享资源不该因一个引用消失而被回收）；
     * 没人引用才调第三方删除并软删映射行，行软删保留以备查账。
     */
    private function deleteAssetWithProvider(AssetDataIsolation $dataIsolation, AssetEntity $asset): bool
    {
        if ($asset->getAssetKind()->isGroup()) {
            if ($this->assets->hasChildren($dataIsolation, $asset->getId())) {
                ExceptionBuilder::throw(AssetErrorCode::GROUP_NOT_EMPTY);
            }
            // 素材组无第三方资源，仅删除本地记录。
            return $this->assets->delete($dataIsolation, $asset);
        }

        $mappingModel = $this->providerAssets->findMapping(
            $dataIsolation,
            $asset->getId(),
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        // 未同步到第三方，直接删除本地记录。
        if ($mappingModel === null) {
            return $this->assets->delete($dataIsolation, $asset);
        }

        $mapping = new ProviderAssetEntity($mappingModel->toArray());

        // 先删除本地记录，再根据映射判断远程资源是否仍被引用。
        $deletedLocally = $this->assets->delete($dataIsolation, $asset);

        // 仍有其他引用时保留远程资源。
        if ($this->providerAssets->countOtherReferences($mapping) > 0) {
            $this->logger->info('素材仍有其它引用，仅删除本地记录，保留第三方资源', [
                'asset_id' => $asset->getId(),
                'provider_asset_id' => $mapping->getProviderAssetId(),
            ]);
            return $deletedLocally;
        }

        // 无其他引用时回收远程资源，成功后删除映射记录。
        if ($this->reclaimProviderAsset($mapping)) {
            $this->providerAssets->deleteMapping(
                $dataIsolation,
                $asset->getId(),
                VolcengineArkAssetProvider::PROVIDER_CODE,
                $this->projectName(),
            );
        }
        return $deletedLocally;
    }

    /**
     * 幂等回收第三方素材与其专属素材组。
     *
     * 回收成功（或本就没有可回收的远程资源）返回 true；只要素材或组回收失败就返回 false，
     * 调用方据此保留映射行，交给补偿任务重试，避免远程资源与本地记录彻底失联。
     */
    private function reclaimProviderAsset(ProviderAssetEntity $mapping): bool
    {
        $providerAssetId = trim($mapping->getProviderAssetId());
        $providerGroupId = trim((string) $mapping->getProviderGroupId());
        if ($providerAssetId === '' && $providerGroupId === '') {
            return true;
        }
        $reclaimedAsset = $providerAssetId === '' || $this->provider()->deleteAsset($providerAssetId, $this->projectName());
        $reclaimedGroup = $providerGroupId === '' || $this->provider()->deleteAssetGroup($providerGroupId, $this->projectName());
        if (! $reclaimedAsset || ! $reclaimedGroup) {
            $this->logger->warning('第三方资源回收未全部成功，映射行保留待补偿', [
                'asset_id' => $mapping->getAssetId(),
                'provider_asset_id' => $providerAssetId,
                'provider_group_id' => $providerGroupId,
            ]);
            return false;
        }
        return true;
    }

    /**
     * Release the remote resources a failed sync left behind.
     */
    private function releaseFailedProviderResources(AssetDataIsolation $dataIsolation, ProviderAssetEntity $mapping): void
    {
        try {
            // A reused mapping shares its remote asset with the row it was copied from.
            if ($this->providerAssets->countOtherReferences($mapping) > 0) {
                return;
            }
            if (! $this->reclaimProviderAsset($mapping)) {
                return;
            }
            $mapping->setProviderAssetId('');
            $mapping->setProviderGroupId('');
            $this->providerAssets->saveMapping($dataIsolation, $mapping);
        } catch (Throwable $throwable) {
            // Releasing is a side effect: it must never mask the original sync failure.
            $this->logger->error('第三方资源释放异常', [
                'asset_id' => $mapping->getAssetId(),
                'provider_asset_id' => $mapping->getProviderAssetId(),
                'provider_group_id' => $mapping->getProviderGroupId(),
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }
    }

    /** 创建公开资产：管理端仍同步等待，个人端由应用层调度协程。 */
    private function create(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        $this->assertParentGroupExists($dataIsolation, $asset);
        $assetEntity = $this->saveLocal($dataIsolation, $asset);
        if ($assetEntity->getAssetKind()->isGroup()) {
            // 素材组仅用于本地层级管理。
            return $assetEntity;
        }
        $assetEntity->setFileUrl($asset->getFileUrl());
        $this->syncToProvider($dataIsolation, $assetEntity);
        return $assetEntity;
    }

    /**
     * 第一段：纯本地落库，不碰第三方。
     *
     * Provider 状态只保存在 magic_asset_provider_assets，资产主表不感知第三方生命周期。
     */
    private function saveLocal(AssetDataIsolation $dataIsolation, AssetEntity $asset): AssetEntity
    {
        $asset->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        if ($asset->getOwnerUid() === null && $asset->getUserId() !== null) {
            $asset->setOwnerUid($asset->getUserId());
        }
        if ($asset->getSearchText() === null || trim($asset->getSearchText()) === '') {
            $asset->setSearchText($this->searchTextBuilder->build($asset));
        }
        $saved = $this->assets->save($dataIsolation, $asset);
        $this->logger->info('资产已落库', ['asset_id' => $saved->getId()]);
        return $saved;
    }

    /**
     * 第二段：同步第三方（只处理素材）。
     *
     * 同一份内容（content_hash 相同）若已有可复用的第三方素材，直接挂上已审核通过的凭证，
     * 不再重复上传——这是「同一张图片只上传一次」的核心。没有可复用的素材才走新建流程。
     *
     * 失败只回写 Provider 映射状态，不回收远程资源：凭证可查、可重试、可人工处置。
     *
     * @param ProviderReviewMode $reviewMode 调用方对素材的预检结论
     */
    private function syncToProvider(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        ProviderReviewMode $reviewMode = ProviderReviewMode::VOLCENGINE,
    ): ProviderAssetEntity {
        // 走到这里说明本次真的要向第三方注册：把结论来源重置为火山，
        // 这样「无人像素材后续被生成链路按需注册」时，用量统计不会继续把它算成未占用。
        $this->markProviderStatus($dataIsolation, $asset, ProviderAssetStatus::PROCESSING, null, ProviderReviewMode::VOLCENGINE);
        try {
            // 命中可复用凭证时跳过上传和合规轮询。
            $reusable = $asset->getContentHash() ? $this->findPassedProviderAssetByContentHash($asset->getContentHash()) : null;
            if ($reusable !== null) {
                $providerAsset = $this->persistReusedMapping($dataIsolation, $asset, $reusable);
                $this->logger->info('复用已存在的第三方素材，跳过上传', [
                    'asset_id' => $asset->getId(),
                    'provider_asset_id' => $reusable->getProviderAssetId(),
                ]);
                if (! $providerAsset->getProviderStatus()->isPassed()) {
                    $this->awaitProviderAssetPassed($dataIsolation, $providerAsset);
                }
                return $providerAsset;
            }

            // 调用方已确认无人像：无需第三方合规审核，不建素材组、不建素材，仅保留本地记录后直接标记通过。
            if ($reviewMode === ProviderReviewMode::NO_PERSON) {
                $this->logger->info('已确认无人像，跳过第三方素材注册', [
                    'asset_id' => $asset->getId(),
                ]);
                return $this->markProviderStatus(
                    $dataIsolation,
                    $asset,
                    ProviderAssetStatus::PASS,
                    null,
                    ProviderReviewMode::NO_PERSON,
                );
            }

            // 为素材创建专属第三方素材组，满足 GroupId 必填约束。
            $providerGroupId = $this->createProviderAssetGroup($this->resolveProviderGroupName($asset));
            $this->persistGroupMapping($dataIsolation, $asset, $providerGroupId);
            $providerAssetEntity = $this->createProviderAsset($dataIsolation, $asset, $providerGroupId);
            $this->awaitProviderAssetPassed($dataIsolation, $providerAssetEntity);
        } catch (BusinessException $exception) {
            // 业务异常文案由错误码统一给出，本身即面向用户，可直接作为失败原因落库展示。
            $failedMapping = $this->markProviderStatus(
                $dataIsolation,
                $asset,
                ProviderAssetStatus::FAILED,
                $exception->getMessage(),
            );
            $this->releaseFailedProviderResources($dataIsolation, $failedMapping);
            throw $exception;
        } catch (Throwable $throwable) {
            // 非业务异常原文可能带第三方地址、凭证或原始响应体，只随日志排查，不写进对用户可见的失败原因。
            $failedMapping = $this->markProviderStatus(
                $dataIsolation,
                $asset,
                ProviderAssetStatus::FAILED,
                trans('asset.provider_response_invalid'),
            );
            $this->releaseFailedProviderResources($dataIsolation, $failedMapping);
            ExceptionBuilder::throw(AssetErrorCode::PROVIDER_RESPONSE_INVALID, '', [], null, $throwable);
        }
        return $providerAssetEntity;
    }

    /**
     * 将复用的第三方凭证写入当前素材映射。
     */
    private function persistReusedMapping(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        ProviderAssetEntity $reusable,
    ): ProviderAssetEntity {
        $providerAssetEntity = new ProviderAssetEntity([
            'asset_id' => $asset->getId(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'provider_code' => VolcengineArkAssetProvider::PROVIDER_CODE,
            'project_name' => $this->projectName(),
            'provider_group_id' => $reusable->getProviderGroupId(),
            'provider_asset_id' => $reusable->getProviderAssetId(),
            'provider_status' => $reusable->getProviderStatus()->value,
            'provider_review_mode' => ProviderReviewMode::REUSED->value,
            'metadata' => $reusable->getMetadata(),
        ]);
        $this->providerAssets->saveMapping($dataIsolation, $providerAssetEntity);
        return $providerAssetEntity;
    }

    /**
     * 更新当前默认 Provider 的状态与失败原因。
     *
     * @param null|ProviderReviewMode $reviewMode 显式给出时一并写入结论来源，为 null 表示不改动它
     */
    private function markProviderStatus(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        ProviderAssetStatus $status,
        ?string $failedReason = null,
        ?ProviderReviewMode $reviewMode = null,
        ?AssetProviderAssetModel $mapping = null,
    ): ProviderAssetEntity {
        // 批量场景已经把映射查回来了，直接复用，避免为了回写再按 ID 查一次。
        $mapping ??= $this->providerAssets->findMapping(
            $dataIsolation,
            (int) $asset->getId(),
            VolcengineArkAssetProvider::PROVIDER_CODE,
        );
        $providerAsset = $mapping === null
            ? new ProviderAssetEntity([
                'asset_id' => $asset->getId(),
                'provider_code' => VolcengineArkAssetProvider::PROVIDER_CODE,
                'project_name' => $this->projectName(),
            ])
            : new ProviderAssetEntity($mapping->toArray());
        $providerAsset->setProviderStatus($status);
        $providerAsset->setProviderFailedReason(
            $status === ProviderAssetStatus::FAILED ? $this->normalizeFailedReason($failedReason) : null,
        );
        if ($reviewMode !== null) {
            $providerAsset->setProviderReviewMode($reviewMode);
        }
        $this->providerAssets->saveMapping($dataIsolation, $providerAsset);
        return $providerAsset;
    }

    private function normalizeFailedReason(?string $reason): ?string
    {
        $reason = trim((string) $reason);
        return $reason === '' ? null : mb_substr($reason, 0, self::FAILED_REASON_MAX_LENGTH);
    }

    /**
     * 判断「发起审核」后是否已超过合规等待上限。
     */
    private function isComplianceExpired(string $submittedAt): bool
    {
        $submittedAtTimestamp = strtotime($submittedAt);
        return $submittedAtTimestamp !== false && time() - $submittedAtTimestamp >= self::COMPLIANCE_TIMEOUT_SECONDS;
    }

    /**
     * 父级只表达本地层级，第三方不再参与校验；但本地父组必须真实存在，
     * 否则素材会落成一条在列表里永远挂不上父组的孤儿记录。
     *
     * 注意这里刻意早于落库：本地校验失败没有「远程已建」的残留，直接拒绝比留下失败记录干净。
     */
    private function assertParentGroupExists(AssetDataIsolation $dataIsolation, AssetEntity $asset): void
    {
        $parentId = $asset->getParentId();
        if ($parentId === null) {
            return;
        }
        $parent = $this->assets->findById($dataIsolation, $parentId);
        if ($parent === null || ! $parent->getAssetKind()->isGroup()) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
    }

    /**
     * 记录素材专属素材组的凭证：远程一旦建出来，凭证就必须在本地可查。
     *
     * 写在素材自己的映射行上，随后的 createProviderAsset 会 upsert 同一行补上素材凭证。
     */
    private function persistGroupMapping(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        string $providerGroupId,
    ): void {
        // 素材尚未创建，映射状态保持处理中。
        $providerAssetGroupEntity = new ProviderAssetEntity([
            'asset_id' => (int) $asset->getId(),
            'provider_code' => VolcengineArkAssetProvider::PROVIDER_CODE,
            'project_name' => $this->projectName(),
            'provider_group_id' => $providerGroupId,
            'provider_status' => ProviderAssetStatus::PROCESSING->value,
        ]);
        $this->providerAssets->saveMapping($dataIsolation, $providerAssetGroupEntity);
        $this->logger->info('第三方素材组凭证已落库', [
            'asset_id' => $providerAssetGroupEntity->getAssetId(),
            'provider_group_id' => $providerGroupId,
        ]);
    }

    /**
     * 调用第三方创建素材组，返回素材组 ID。
     */
    private function createProviderAssetGroup(string $groupName): string
    {
        $response = $this->provider()->createAssetGroup([
            'name' => $groupName,
            'project_name' => $this->projectName(),
        ]);
        $providerGroupId = trim((string) ($response['provider_group_id'] ?? ''));
        if ($providerGroupId === '') {
            ExceptionBuilder::throw(AssetErrorCode::PROVIDER_RESPONSE_INVALID);
        }
        $this->logger->info('第三方素材组创建完成', [
            'provider_group_id' => $providerGroupId,
            'name' => $groupName,
        ]);
        return $providerGroupId;
    }

    /**
     * 创建第三方素材并保存返回的凭证。
     */
    private function createProviderAsset(
        AssetDataIsolation $dataIsolation,
        AssetEntity $asset,
        string $providerGroupId,
    ): ProviderAssetEntity {
        $this->logger->info('第三方素材创建开始', [
            'asset_id' => $asset->getId(),
            'provider_group_id' => $providerGroupId,
        ]);

        $response = $this->provider()->createAsset([
            ...$asset->toArray(),
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'group_id' => $providerGroupId,
            'project_name' => $this->projectName(),
        ]);
        $providerAssetId = (string) ($response['provider_asset_id'] ?? $response['asset_id'] ?? $response['id'] ?? '');
        if ($providerAssetId === '') {
            // 缺少第三方素材 ID 时无法建立映射。
            ExceptionBuilder::throw(AssetErrorCode::PROVIDER_RESPONSE_INVALID);
        }
        $providerAssetEntity = new ProviderAssetEntity([
            'asset_id' => $asset->getId(),
            'provider_code' => VolcengineArkAssetProvider::PROVIDER_CODE,
            'project_name' => $this->projectName(),
            'provider_group_id' => $providerGroupId,
            'provider_asset_id' => $providerAssetId,
            'provider_status' => ProviderAssetStatus::fromValue(
                $response['provider_status'] ?? $response['status'] ?? ProviderAssetStatus::PROCESSING->value,
            )->value,
            // 仅保存第三方返回的扩展 metadata。
            'metadata' => is_array($response['metadata'] ?? null) ? $response['metadata'] : null,
        ]);
        $this->providerAssets->saveMapping($dataIsolation, $providerAssetEntity);
        return $providerAssetEntity;
    }

    /**
     * 等第三方给出合规结论：审核中就一直回查，到达上限即判失败。
     *
     * 超时不回收——素材可能仍在第三方审核，删除会打断审核流程。
     * 凭证已在映射表里，留给人工或后续补偿处置。
     */
    private function awaitProviderAssetPassed(
        AssetDataIsolation $dataIsolation,
        ProviderAssetEntity $providerAssetEntity,
    ): void {
        $deadline = microtime(true) + $this->complianceTimeoutSeconds();
        $status = $providerAssetEntity->getProviderStatus();

        while (! $status->isPassed()) {
            if (! $status->isProcessing()) {
                $this->logger->error('第三方素材合规未通过', [
                    'provider_asset_id' => $providerAssetEntity->getProviderAssetId(),
                    'provider_status' => $status->value,
                ]);
                $this->persistProviderStatus($dataIsolation, $providerAssetEntity, $status);
                ExceptionBuilder::throw(AssetErrorCode::COMPLIANCE_FAILED);
            }
            if ($this->isComplianceWaitExpired($deadline)) {
                $this->logger->error('第三方素材合规回查超时', [
                    'provider_asset_id' => $providerAssetEntity->getProviderAssetId(),
                    'timeout_seconds' => self::COMPLIANCE_TIMEOUT_SECONDS,
                ]);
                ExceptionBuilder::throw(AssetErrorCode::COMPLIANCE_TIMEOUT);
            }
            $this->waitBeforeNextCompliancePoll();
            $status = $this->fetchProviderStatus($providerAssetEntity);
        }

        // 仅在轮询后更新最终状态，避免重复写入。
        if (! $providerAssetEntity->getProviderStatus()->isPassed()) {
            $this->persistProviderStatus($dataIsolation, $providerAssetEntity, $status);
        }
    }

    /**
     * 查询一次第三方状态；异常时按处理中返回。
     */
    private function fetchProviderStatus(ProviderAssetEntity $providerAssetEntity): ProviderAssetStatus
    {
        try {
            $state = $this->provider()->getAssetStatus($providerAssetEntity->getProviderAssetId(), $this->projectName());
        } catch (Throwable $throwable) {
            $this->logger->warning('第三方素材状态回查失败，继续等待', [
                'provider_asset_id' => $providerAssetEntity->getProviderAssetId(),
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            return ProviderAssetStatus::PROCESSING;
        }
        return ProviderAssetStatus::fromValue(
            $state['provider_status'] ?? $state['status'] ?? ProviderAssetStatus::PROCESSING->value,
        );
    }

    /**
     * 将第三方状态写回映射表，失败时仅记录日志。
     */
    private function persistProviderStatus(
        AssetDataIsolation $dataIsolation,
        ProviderAssetEntity $providerAssetEntity,
        ProviderAssetStatus $status,
    ): void {
        try {
            $providerAssetEntity->setProviderStatus($status);
            if ($status !== ProviderAssetStatus::FAILED) {
                $providerAssetEntity->setProviderFailedReason(null);
            }
            $this->providerAssets->saveMapping($dataIsolation, $providerAssetEntity);
        } catch (Throwable $throwable) {
            $this->logger->error('第三方素材状态回写失败', [
                'provider_asset_id' => $providerAssetEntity->getProviderAssetId(),
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
        }
    }

    private function updateAttributes(AssetDataIsolation $dataIsolation, AssetEntity $asset): ?AssetEntity
    {
        if ($asset->getId() === null) {
            return null;
        }
        $asset->setSearchText($this->searchTextBuilder->build($asset, $asset->getTags()));
        return $this->assets->update($dataIsolation, $asset);
    }

    /**
     * 根据素材名称生成第三方素材组名称。
     */
    private function resolveProviderGroupName(AssetEntity $asset): string
    {
        $name = trim($asset->getI18nName('default'));
        return $name === '' ? trans('asset.unnamed_group') : $name;
    }

    /** @return array{provider: AssetProviderInterface, projectName: string} */
    private function providerContext(): array
    {
        return Context::getOrSet(
            self::PROVIDER_CONTEXT_KEY,
            function (): array {
                $providerConfig = $this->providerConfig();
                return [
                    'provider' => $this->createAssetProvider($providerConfig),
                    'projectName' => trim((string) ($providerConfig['project_name'] ?? '')) ?: self::DEFAULT_PROJECT_NAME,
                ];
            },
        );
    }

    private function provider(): AssetProviderInterface
    {
        return $this->providerContext()['provider'];
    }

    /**
     * 第三方项目名，与 provider 取自同一份协程缓存。
     */
    private function projectName(): string
    {
        return $this->providerContext()['projectName'];
    }

    /** @return array<string, mixed> */
    private function providerConfig(): array
    {
        return $this->resolveProviderConfig(
            $this->abilityDomainService->getProviderConfig(AiAbilityCode::VolcengineArkAssets),
        );
    }

    /** @param array<string, mixed> $config @return array<string, mixed> */
    private function resolveProviderConfig(array $config): array
    {
        $providers = $config['providers'] ?? null;
        if (! is_array($providers)) {
            return $config;
        }
        // 兼容管理端早期将单个 provider 保存为对象而非数组的配置形态。
        if (isset($providers['provider'])) {
            return $providers;
        }
        foreach ($providers as $provider) {
            if (is_array($provider) && ($provider['enable'] ?? false) === true) {
                return $provider;
            }
        }
        return [];
    }
}
