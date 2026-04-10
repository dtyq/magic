<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageRemoveBackground;

use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Driver\OfficialImageRemoveBackgroundDriver;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\Driver\OfficialProxyImageRemoveBackgroundDriver;
use App\Infrastructure\Util\File\ImageFileInspector;
use Hyperf\Logger\LoggerFactory;
use RuntimeException;

/**
 * 根据 provider 标识创建去背景驱动实例。
 */
class ImageRemoveBackgroundDriverFactory
{
    public const PROVIDER_OFFICIAL_PROXY = 'official_proxy';

    public const PROVIDER_OFFICIAL_MODEL_SERVICE = 'official_model_service';

    public function __construct(
        private readonly ImageFileInspector $imageFileInspector,
        private readonly LoggerFactory $loggerFactory,
    ) {
    }

    /**
     * @param array<string, mixed> $providerConfig
     */
    public function create(string $providerCode, array $providerConfig): ImageRemoveBackgroundDriverInterface
    {
        return match ($providerCode) {
            self::PROVIDER_OFFICIAL_PROXY => new OfficialProxyImageRemoveBackgroundDriver($providerConfig, $this->imageFileInspector, $this->loggerFactory),
            self::PROVIDER_OFFICIAL_MODEL_SERVICE => new OfficialImageRemoveBackgroundDriver($providerConfig, $this->imageFileInspector, $this->loggerFactory),
            default => throw new RuntimeException("Unsupported image remove background provider: {$providerCode}"),
        };
    }
}
