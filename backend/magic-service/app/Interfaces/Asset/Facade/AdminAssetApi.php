<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\Facade;

use App\Application\Asset\Service\AdminAssetAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Asset\Assembler\AssetAssembler;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\SaveAssetTagRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AdminAssetApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly AdminAssetAppService $assetAppService,
    ) {
        parent::__construct($request);
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function create(): array
    {
        $requestDTO = CreateAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        $asset = $this->assetAppService->createPublicAsset(
            $authorization,
            $requestDTO,
        );
        return AssetAssembler::createItem(
            $asset,
            null,
            true,
            $this->assetAppService->providerAsset($authorization, (int) $asset->getId()),
        )->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $requestDTO = QueryAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
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
            true,
            $result['provider_assets'],
        )->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function update(int|string $assetId): array
    {
        $requestDTO = UpdateAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        $asset = $this->assetAppService->updatePublicAsset(
            $authorization,
            $assetId,
            $requestDTO,
        );
        if ($asset === null) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        return AssetAssembler::createItem(
            $asset,
            null,
            true,
            $this->assetAppService->providerAsset($authorization, $assetId),
        )->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function delete(int|string $assetId): array
    {
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        $deleted = $this->assetAppService->deletePublicAsset(
            $authorization,
            $assetId,
        );
        return AssetAssembler::createDeleteDTO($assetId, $deleted, true)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function createTag(): array
    {
        $authorization = $this->getAuthorization();
        $request = SaveAssetTagRequestDTO::fromRequest($this->request);
        return AssetAssembler::createTagItem($this->assetAppService->createOfficialTag(
            $authorization,
            $request->getName(),
            $request->getNodeType(),
            $request->getParentId(),
            $request->getBusinessType(),
        ));
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::QUERY)]
    public function tags(): array
    {
        $authorization = $this->getAuthorization();
        // 不传 business_type 返回全部业务类型，便于后台总览；传了只看该类型。
        $businessType = trim((string) $this->request->input('business_type', ''));
        return AssetAssembler::createTagList($this->assetAppService->listOfficialTags($authorization, $businessType === '' ? null : $businessType));
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function updateTag(int|string $tagId): array
    {
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        $request = SaveAssetTagRequestDTO::fromRequest($this->request);
        return AssetAssembler::createTagItem($this->assetAppService->updateOfficialTag($authorization, $tagId, $request->getName(), $request->getNodeType(), $request->getParentId()));
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function deleteTag(int|string $tagId): array
    {
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        $this->assetAppService->deleteOfficialTag($authorization, $tagId);
        return ['id' => (string) $tagId, 'deleted' => true];
    }

    /**
     * 第三方素材与素材组占用数量，用于核对火山方舟侧的配额消耗。
     */
    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::QUERY)]
    public function providerResourceUsage(): array
    {
        $authorization = $this->getAuthorization();
        $this->assertAdmin($authorization);
        return $this->assetAppService->providerResourceUsage();
    }

    private function assertAdmin(object $authorization): void
    {
        if (! PermissionChecker::isOrganizationAdminByUserId(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        )) {
            ExceptionBuilder::throw(AssetErrorCode::ADMIN_DENIED);
        }
    }
}
