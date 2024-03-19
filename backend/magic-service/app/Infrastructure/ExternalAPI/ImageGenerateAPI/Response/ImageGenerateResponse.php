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
                if (! EasyFileTools::isBase64Image($base64)) {
                    // 检查 base64 格式是否符合规范, 尝试添加前缀
                    $base64 = 'data:image/jpeg;base64,' . $base64;
                    if (EasyFileTools::isBase64Image($base64)) {
                        $base64Data[] = $base64;
                    }
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
