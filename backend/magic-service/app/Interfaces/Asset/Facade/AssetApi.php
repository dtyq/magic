<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\Facade;

use App\Application\Asset\Service\AssetAppService;
use App\Domain\Asset\Entity\AssetEntity;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Asset\Assembler\AssetAssembler;
use App\Interfaces\Asset\DTO\Request\BatchAssetIdsRequestDTO;
use App\Interfaces\Asset\DTO\Request\BatchGetAssetsRequestDTO;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\SaveAssetTagRequestDTO;
use App\Interfaces\Asset\DTO\Request\SaveAssetToLibraryRequestDTO;
use App\Interfaces\Asset\DTO\Request\TransferAssetOwnerRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdatePersonalAssetRequestDTO;
use App\Interfaces\Asset\DTO\Response\AssetComplianceDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AssetApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly AssetAppService $assetAppService,
    ) {
        parent::__construct($request);
    }

    public function create(): array
    {
        $requestDTO = CreateAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $asset = $this->assetAppService->createPersonalAsset(
            $authorization,
            $requestDTO,
        );
        return AssetAssembler::createItem(
            $asset,
            null,
            false,
            $this->assetAppService->providerAsset($authorization, (int) $asset->getId()),
        )->toArray();
    }

    public function signAgreement(): array
    {
        $this->assetAppService->signAgreement($this->getAuthorization());
        return [];
    }

    /** 查询当前用户在当前组织是否已签署素材协议。 */
    public function agreementStatus(): array
    {
        return ['signed' => $this->assetAppService->hasSignedAgreement($this->getAuthorization())];
    }

    /**
     * 保存到「我的素材库」：不做第三方合规同步，直接落库并登记可见范围。
     */
    public function saveToLibrary(): array
    {
        $requestDTO = SaveAssetToLibraryRequestDTO::fromRequest($this->request);
        $asset = $this->assetAppService->saveToLibrary(
            $this->getAuthorization(),
            $requestDTO,
        );
        return AssetAssembler::createItem($asset)->toArray();
    }

    public function list(): array
    {
        $requestDTO = QueryAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $result = $this->assetAppService->list(
            $authorization,
            $requestDTO,
        );
        $page = new Page(
            $requestDTO->getPage(),
            $requestDTO->getPageSize(),
        );
        return AssetAssembler::createList(
            $result['list'],
            $page,
            $result['total'],
            [],
            false,
            $result['provider_assets'],
        )->toArray();
    }

    public function detail(int|string $assetId): array
    {
        $authorization = $this->getAuthorization();
        $asset = $this->assetAppService->detail($authorization, $assetId);
        if ($asset === null) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        return AssetAssembler::createItem(
            $asset,
            null,
            false,
            $this->assetAppService->providerAsset($authorization, $assetId),
        )->toArray();
    }

    public function update(int|string $assetId): array
    {
        $authorization = $this->getAuthorization();
        $asset = $this->assetAppService->updatePersonalAsset(
            $authorization,
            $assetId,
            UpdatePersonalAssetRequestDTO::fromRequest($this->request),
        );
        return AssetAssembler::createItem(
            $asset,
            null,
            false,
            $this->assetAppService->providerAsset($authorization, $assetId),
        )->toArray();
    }

    public function batchGet(): array
    {
        $requestDTO = BatchGetAssetsRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $assets = $this->assetAppService->findByIds(
            $authorization,
            $requestDTO->getAssetIds(),
        );
        $providerAssets = $this->assetAppService->findProviderAssets(
            $authorization,
            $requestDTO->getAssetIds(),
        );
        return array_map(
            static fn (AssetEntity $asset): array => AssetAssembler::createItem(
                $asset,
                null,
                false,
                $providerAssets[(string) $asset->getId()] ?? null,
            )->toArray(),
            $assets,
        );
    }

    public function compliance(int|string $assetId): array
    {
        return (new AssetComplianceDTO(
            $assetId,
            $this->assetAppService->compliance($this->getAuthorization(), $assetId),
        ))->toArray();
    }

    public function batchCompliance(): array
    {
        $request = BatchAssetIdsRequestDTO::fromRequest($this->request);
        return ['items' => $this->assetAppService->batchCompliance($this->getAuthorization(), $request->getAssetIds())];
    }

    public function delete(int|string $assetId): array
    {
        $authorization = $this->getAuthorization();
        $deleted = $this->assetAppService->deletePersonalAsset(
            $authorization,
            $assetId,
        );
        return AssetAssembler::createDeleteDTO($assetId, $deleted)->toArray();
    }

    public function batchDelete(): array
    {
        $request = BatchAssetIdsRequestDTO::fromRequest($this->request);
        $assetIds = $request->getAssetIds();
        $deletedIds = $this->assetAppService->batchDeletePersonalAssets($this->getAuthorization(), $assetIds);
        return ['deleted_num' => count($deletedIds), 'asset_ids' => $deletedIds];
    }

    public function tags(): array
    {
        return AssetAssembler::createTagList($this->assetAppService->listTags($this->getAuthorization()));
    }

    public function createTag(): array
    {
        $request = SaveAssetTagRequestDTO::fromRequest($this->request);
        $tag = $this->assetAppService->saveTag($this->getAuthorization(), $request->getName(), $request->getNodeType(), $request->getParentId());
        return AssetAssembler::createTagItem($tag);
    }

    public function updateTag(int|string $tagId): array
    {
        $request = SaveAssetTagRequestDTO::fromRequest($this->request);
        $tag = $this->assetAppService->updateTag($this->getAuthorization(), $tagId, $request->getName(), $request->getNodeType(), $request->getParentId());
        return AssetAssembler::createTagItem($tag);
    }

    public function deleteTag(int|string $tagId): array
    {
        $this->assetAppService->deleteTag($this->getAuthorization(), $tagId);
        return ['id' => (string) $tagId, 'deleted' => true];
    }

    public function updateTags(int|string $assetId): array
    {
        $tagIds = (array) $this->request->input('tag_ids', []);
        $this->assetAppService->syncAssetTags($this->getAuthorization(), $assetId, $tagIds);
        return ['asset_id' => (string) $assetId, 'tag_ids' => array_values(array_map('strval', $tagIds))];
    }

    public function owners(): array
    {
        return AssetAssembler::createOwnerList($this->assetAppService->listOwners($this->getAuthorization()));
    }

    public function transferOwner(): array
    {
        $request = TransferAssetOwnerRequestDTO::fromRequest($this->request);
        return $this->assetAppService->transferOwner($this->getAuthorization(), $request->getAssetIds(), $request->getOwnerUid());
    }
}
