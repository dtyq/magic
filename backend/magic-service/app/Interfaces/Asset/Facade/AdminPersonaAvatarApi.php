<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\Facade;

use App\Application\Asset\Service\AdminPersonaAvatarAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Asset\Assembler\AssetAssembler;
use App\Interfaces\Asset\DTO\Request\CreateAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\QueryAssetRequestDTO;
use App\Interfaces\Asset\DTO\Request\UpdateAssetRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 人设头像库后台管理接口（暂无界面，供导入脚本上传和维护头像）。
 *
 * 创建前需先把图片上传到对象存储，这里只接收 file_key；
 * 标签用官方标签的 ID，标签必须属于业务类型 PERSONA_AVATAR。
 */
#[ApiResponse('low_code')]
class AdminPersonaAvatarApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        private readonly AdminPersonaAvatarAppService $avatarAppService,
    ) {
        parent::__construct($request);
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function create(): array
    {
        $requestDTO = CreateAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $asset = $this->avatarAppService->createAvatar($authorization, $requestDTO);
        return AssetAssembler::createItem($asset, null, true, null)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $requestDTO = QueryAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        $result = $this->avatarAppService->listAvatars($authorization, $requestDTO);
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        return AssetAssembler::createList($result['list'], $page, $result['total'], [], true, [])->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function update(int|string $assetId): array
    {
        $requestDTO = UpdateAssetRequestDTO::fromRequest($this->request);
        $authorization = $this->getAuthorization();
        // 请求里没有 tag_ids 表示不改标签；传空数组表示清空。
        $tagIds = $this->request->has('tag_ids')
            ? array_values(array_unique(array_filter(
                array_map('intval', (array) $this->request->input('tag_ids')),
                static fn (int $id): bool => $id > 0,
            )))
            : null;
        $asset = $this->avatarAppService->updateAvatar($authorization, $assetId, $requestDTO, $tagIds);
        if ($asset === null) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        return AssetAssembler::createItem($asset, null, true, null)->toArray();
    }

    #[CheckPermission([MagicResourceEnum::PLATFORM_ASSET], MagicOperationEnum::EDIT)]
    public function delete(int|string $assetId): array
    {
        $authorization = $this->getAuthorization();
        $deleted = $this->avatarAppService->deleteAvatar($authorization, $assetId);
        return AssetAssembler::createDeleteDTO($assetId, $deleted, true)->toArray();
    }
}
