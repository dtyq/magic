<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response;

use App\Infrastructure\ExternalAPI\ImageGenerateAPI\ImageGenerateType;
use Dtyq\CloudFile\Kernel\Utils\EasyFileTools;

class ImageGenerateResponse
{
    private ImageGenerateType $imageGenerateType;

    // 可以是 base64 也可能是 urls
    private array $data;

    public function __construct(ImageGenerateType $imageGenerateType, array $data)
    {
        $this->imageGenerateType = $imageGenerateType;
        $this->data = $data;
        if ($imageGenerateType->isBase64()) {
            $base64Data = [];
            foreach ($data as $base64) {
                if (EasyFileTools::isBase64Image($base64)) {
                    $base64Data[] = $base64;
                    continue;
                }
                // 水印处理后可能已经是云存储 URL，不能再包装成 data URI。
                if (EasyFileTools::isUrl($base64)) {
                    $base64Data[] = $base64;
                    continue;
                }
                $candidate = 'data:image/jpeg;base64,' . $base64;
                if (EasyFileTools::isBase64Image($candidate)) {
                    $base64Data[] = $candidate;
                }
            }
            $this->data = $base64Data;
        }
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function getImageGenerateType(): ImageGenerateType
    {
        return $this->imageGenerateType;
    }
}
