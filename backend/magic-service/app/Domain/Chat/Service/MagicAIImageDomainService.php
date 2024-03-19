<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionModel;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Request\MiracleVisionModelRequest;

/**
 * AI文生图.
 */
class MagicAIImageDomainService extends AbstractDomainService
{
    // 图片转高清
    public function imageConvertHigh(string $url, MiracleVisionModel $imageGenerateService): string
    {
        if (empty($url)) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::NO_VALID_IMAGE, 'image_generate.image_url_is_empty');
        }

        return $imageGenerateService->imageConvertHigh(new MiracleVisionModelRequest($url));
    }
}
