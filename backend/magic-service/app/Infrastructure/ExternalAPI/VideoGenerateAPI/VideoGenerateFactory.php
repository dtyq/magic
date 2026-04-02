<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

/**
 * 视频 provider adapter 工厂。
 *
 * 这是 domain 工厂接口在 infrastructure 的默认实现，
 * 负责把 providerCode 映射成实际 adapter。
 */
readonly class VideoGenerateFactory implements VideoGenerationProviderAdapterFactoryInterface
{
    public function __construct(
        private WuyinVideoAdapterRouter $wuyinVideoAdapterRouter,
        private CloudswayVideoAdapterRouter $cloudswayVideoAdapterRouter,
    ) {
    }

    public function create(VideoGenerateProviderType $providerType): VideoGenerationProviderAdapterInterface
    {
        // 目前只接入了 Wuyin 视频 provider，后续新增 provider 时在这里继续扩展。
        return match ($providerType) {
            VideoGenerateProviderType::Wuyin => $this->wuyinVideoAdapterRouter,
            VideoGenerateProviderType::Cloudsway => $this->cloudswayVideoAdapterRouter,
        };
    }

    public function createByProviderCode(ProviderCode $providerCode, ?string $modelVersion = null): VideoGenerationProviderAdapterInterface
    {
        // domain 只依赖工厂接口，不直接认识具体 adapter；
        // infrastructure 在这里完成 providerCode 到 adapter 的绑定。
        return $this->create(VideoGenerateProviderType::fromProviderCode($providerCode, $modelVersion));
    }
}
