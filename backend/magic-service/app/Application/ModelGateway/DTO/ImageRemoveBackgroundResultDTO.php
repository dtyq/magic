<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 去背景成功结果对象，负责输出统一的图片响应结构。
 */
class ImageRemoveBackgroundResultDTO extends AbstractDTO
{
    protected string $url = '';

    protected string $mimeType = '';

    protected string $provider = '';

    public function getUrl(): string
    {
        return $this->url;
    }

    public function getMimeType(): string
    {
        return $this->mimeType;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function toOpenAIFormatResponse(): OpenAIFormatResponse
    {
        return new OpenAIFormatResponse([
            'created' => time(),
            'data' => [
                [
                    'url' => $this->url,
                    'mime_type' => $this->mimeType,
                ],
            ],
            'usage' => null,
            'provider' => $this->provider,
        ]);
    }
}
