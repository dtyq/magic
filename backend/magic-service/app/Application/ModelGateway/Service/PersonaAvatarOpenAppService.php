<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\Asset\Entity\AssetDataIsolation;
use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\ValueObject\AssetBusinessType;
use App\Domain\Asset\Entity\ValueObject\AssetScope;
use App\Domain\Asset\Entity\ValueObject\Query\AssetQuery;
use App\Domain\Asset\Service\AssetDomainService;
use App\Domain\Asset\Service\AssetTagDomainService;
use App\Domain\ModelGateway\Entity\Dto\PersonaAvatarRequestDTO;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Hyperf\Di\Annotation\Inject;

/**
 * 沙箱里的 Agent 工具读取人设头像库（open 接口，使用 ApiKey）。
 *
 * 分两步，与幻灯片模板一致：先取全部头像的精简清单，选定后再按需取文件地址。
 * 清单不含文件地址，所以不会有签名过期问题；打分和选择在 Agent 工具里完成。
 * 头像是平台免费提供的素材，不扣积分、不记用量事件。
 */
class PersonaAvatarOpenAppService extends AbstractLLMAppService
{
    #[Inject]
    protected AssetDomainService $assetDomainService;

    #[Inject]
    protected AssetTagDomainService $assetTagDomainService;

    /**
     * @return array{items: array<int, array{id: string, tags: array<string, array<int, string>>}>}
     *
     * 例：{"items": [{"id": "123", "tags": {"country": ["CN"], "hair": ["short", "dark"]}}]}
     * 标签按「组名 → 标签名列表」给出，组名是维度，标签名是取值编码
     */
    public function getCatalog(PersonaAvatarRequestDTO $requestDTO): array
    {
        $dataIsolation = $this->createAvatarDataIsolation($requestDTO);

        $query = $this->createQuery();
        $query->setStatus(1);
        $assets = $this->assetDomainService->queries($dataIsolation, $query, Page::createNoPage())['list'];
        if ($assets === []) {
            return ['items' => []];
        }

        $tagsByAsset = $this->assetTagDomainService->findTagsByAssetIds(
            $dataIsolation,
            array_values(array_filter(array_map(static fn (AssetEntity $asset): ?int => $asset->getId(), $assets))),
        );
        // 标签只有两级：组（维度）→ 标签（取值）。按标签 ID 反查所属组名。
        $groupNameByTagId = [];
        foreach ($this->assetTagDomainService->listVisible($dataIsolation, AssetBusinessType::PERSONA_AVATAR) as $group) {
            foreach ($group->getChildren() as $tag) {
                $groupNameByTagId[(string) $tag->getId()] = $group->getI18nName('default');
            }
        }

        $items = [];
        foreach ($assets as $asset) {
            $tags = [];
            foreach ($tagsByAsset[(string) $asset->getId()] ?? [] as $tag) {
                $group = $groupNameByTagId[(string) $tag->getId()] ?? null;
                if ($group !== null) {
                    $tags[$group][] = $tag->getI18nName('default');
                }
            }
            $items[] = ['id' => (string) $asset->getId(), 'tags' => $tags];
        }
        return ['items' => $items];
    }

    /**
     * @return array{id: string, file_url: string, expires_at: int}
     */
    public function getFileUrl(PersonaAvatarRequestDTO $requestDTO, string $avatarId): array
    {
        $dataIsolation = $this->createAvatarDataIsolation($requestDTO);
        $asset = $this->assetDomainService->findPublic($dataIsolation, $avatarId);
        // 只开放头像库里已启用的素材，别的业务类型的官方素材按不存在处理。
        if ($asset === null
            || $asset->getAssetBusinessType() !== AssetBusinessType::PERSONA_AVATAR
            || ! $asset->getStatus()->isEnabled()
            || trim((string) $asset->getFileKey()) === ''
        ) {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        $fileKey = (string) $asset->getFileKey();
        $link = $this->getPrivateFileLinks($asset->getOrganizationCode(), [$fileKey])[$fileKey] ?? null;
        if (! $link instanceof FileLink || trim($link->getUrl()) === '') {
            ExceptionBuilder::throw(AssetErrorCode::NOT_FOUND);
        }
        return ['id' => (string) $asset->getId(), 'file_url' => $link->getUrl(), 'expires_at' => $link->getExpires()];
    }

    private function createAvatarDataIsolation(PersonaAvatarRequestDTO $requestDTO): AssetDataIsolation
    {
        $modelGatewayDataIsolation = $this->createModelGatewayDataIsolationByAccessToken(
            $requestDTO->getAccessToken(),
            $requestDTO->getBusinessParams(),
        );
        $dataIsolation = new AssetDataIsolation();
        $dataIsolation->extends($modelGatewayDataIsolation);
        $dataIsolation->setOfficialOrganizationCodes($modelGatewayDataIsolation->getOfficialOrganizationCodes());
        // 头像只存在于官方组织；标签同样来自官方组织。
        $dataIsolation->setOnlyOfficialOrganization(true);
        return $dataIsolation;
    }

    private function createQuery(): AssetQuery
    {
        $query = new AssetQuery();
        $query->setScope(AssetScope::PUBLIC);
        $query->setAssetKind('ASSET');
        $query->setAssetBusinessType(AssetBusinessType::PERSONA_AVATAR);
        return $query;
    }
}
