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

final class ImageAssetMaterializer
{
    public function __construct(
        private readonly SecureImageDownloader $secureImageDownloader,
    ) {
    }

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
