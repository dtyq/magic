<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu\Image;

use Fan\Feishu\AccessToken\TenantAccessToken;
use Fan\Feishu\HasAccessToken;
use Fan\Feishu\Http\Client;
use Fan\Feishu\ProviderInterface;

class Image implements ProviderInterface
{
    use HasAccessToken;

    public function __construct(protected Client $client, protected TenantAccessToken $token)
    {
    }

    /**
     * 上传图片.
     *
     * @param string $imageUrl 图片URL
     * @param string $imageType 图片类型，可选值：message、avatar
     * @return string 图片key
     */
    public function uploadByUrl(string $imageUrl, string $imageType = 'message'): string
    {
        // 下载图片内容
        $imageContent = file_get_contents($imageUrl);
        if ($imageContent === false) {
            return '';
        }

        // 获取图片类型
        $imageInfo = getimagesizefromstring($imageContent);
        $mimeType = $imageInfo['mime'] ?? 'image/jpeg';

        // 构建请求
        $response = $this->request('POST', 'open-apis/im/v1/images', [
            'multipart' => [
                [
                    'name' => 'image_type',
                    'contents' => $imageType,
                ],
                [
                    'name' => 'image',
                    'contents' => $imageContent,
                    'filename' => 'image.' . $this->getExtensionFromMimeType($mimeType),
                    'headers' => [
                        'Content-Type' => $mimeType,
                    ],
                ],
            ],
        ]);

        return $response['data']['image_key'] ?? '';
    }

    public static function getName(): string
    {
        return 'image';
    }

    /**
     * 根据MIME类型获取文件扩展名.
     *
     * @param string $mimeType MIME类型
     * @return string 文件扩展名
     */
    private function getExtensionFromMimeType(string $mimeType): string
    {
        $map = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/bmp' => 'bmp',
            'image/webp' => 'webp',
        ];

        return $map[$mimeType] ?? 'jpg';
    }
}
