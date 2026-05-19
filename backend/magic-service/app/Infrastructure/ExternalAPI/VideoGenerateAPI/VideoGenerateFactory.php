<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\DashScopeVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingVideoAdapterRouter;

/**
 * 视频 provider adapter 工厂。
 *
 * 这是 domain 工厂接口在 infrastructure 的默认实现，
 * 负责把 providerCode 映射成实际 adapter。
 */
readonly class VideoGenerateFactory implements VideoGenerationProviderAdapterFactoryInterface
{
    public function __construct(
        private CloudswayVideoAdapterRouter $cloudswayVideoAdapterRouter,
        private KelingVideoAdapterRouter $kelingVideoAdapterRouter,
        private VolcengineArkSeedanceVideoAdapter $volcengineArkSeedanceVideoAdapter,
        private DashScopeVideoAdapterRouter $dashScopeVideoAdapterRouter,
    ) {
    }

    public function create(VideoGenerateProviderType $providerType): VideoGenerationProviderAdapterInterface
    {
        return match ($providerType) {
            VideoGenerateProviderType::Cloudsway => $this->cloudswayVideoAdapterRouter,
            VideoGenerateProviderType::DashScope => $this->dashScopeVideoAdapterRouter,
            VideoGenerateProviderType::Keling => $this->kelingVideoAdapterRouter,
            VideoGenerateProviderType::VolcengineArk => $this->volcengineArkSeedanceVideoAdapter,
        };
    }

    public function createByProviderCode(ProviderCode $providerCode, ?string $modelVersion = null): VideoGenerationProviderAdapterInterface
    {
        // domain 只依赖工厂接口，不直接认识具体 adapter；
        // infrastructure 在这里完成 providerCode 到 adapter 的绑定。
        return $this->create(VideoGenerateProviderType::fromProviderCode($providerCode, $modelVersion));
    }
}
