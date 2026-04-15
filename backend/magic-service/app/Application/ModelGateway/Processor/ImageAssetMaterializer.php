<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;
use App\Infrastructure\ExternalAPI\Image\ImageAsset;
use App\Infrastructure\ExternalAPI\ImageRemoveBackground\ImageRemoveBackgroundResult;
use App\Infrastructure\Util\File\SecureImageDownloader;
use App\Infrastructure\Util\File\TemporaryFileManager;

/**
 * 把去背景 driver 的专属结果统一转成平台内部可继续处理的图片资产。
 * 该类是“外部协议”进入“通用图片处理管线”的桥接点。
 */
final class ImageAssetMaterializer
{
    public function __construct(
        private readonly SecureImageDownloader $secureImageDownloader,
    ) {
    }

    /**
     * 将 driver 返回的本地文件或远程 URL 物化为可进入处理管线的上下文。
     * 远程 URL 会在这里被安全下载并登记到临时文件管理器中。
     */
    public function materialize(
        ImageRemoveBackgroundResult $result,
        TemporaryFileManager $temporaryFileManager,
    ): ImageProcessContext {
        if ($result->isLocalFile()) {
            $temporaryFileManager->add($result->getValue());

            return new ImageProcessContext(
                asset: ImageAsset::fromLocalFile(
                    $result->getValue(),
                    $result->getMimeType(),
                    $result->getProvider(),
                    $result->getSize(),
                ),
                localFilePath: $result->getValue(),
            );
        }

        $materializedAsset = $this->secureImageDownloader->download($result->getValue());
        $temporaryFileManager->add($materializedAsset->getValue());

        return new ImageProcessContext(
            asset: new ImageAsset(
                type: $materializedAsset->getType(),
                value: $materializedAsset->getValue(),
                mimeType: $materializedAsset->getMimeType(),
                provider: $result->getProvider() ?? $materializedAsset->getProvider(),
                size: $materializedAsset->getSize(),
            ),
            localFilePath: $materializedAsset->getValue(),
        );
    }
}
