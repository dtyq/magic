<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service\ThirdPlatformChat\FeiShuRobot\FeiShu\File;

use Fan\Feishu\AccessToken\TenantAccessToken;
use Fan\Feishu\Exception\TokenInvalidException;
use Fan\Feishu\HasAccessToken;
use Fan\Feishu\Http\Client;
use Fan\Feishu\ProviderInterface;

class File implements ProviderInterface
{
    use HasAccessToken;

    public function __construct(protected Client $client, protected TenantAccessToken $token)
    {
    }

    /**
     * 获取IM文件.
     *
     * @param string $messageId 消息ID
     * @param string $fileKey 文件Key
     * @param string $type 文件类型
     * @return string 文件路径
     */
    public function getIMFile(string $messageId, string $fileKey, string $type = 'file'): string
    {
        if (empty($fileKey)) {
            return '';
        }
        $retry = true;
        try {
            retry:
            $method = 'GET';
            $uri = 'open-apis/im/v1/messages/' . $messageId . '/resources/' . $fileKey;
            $options = [
                'query' => [
                    'type' => $type,
                ],
            ];
            $response = $this->client->client($this->token)->request($method, $uri, $options);
        } catch (TokenInvalidException) {
            $this->token->getToken(true);
            /* @phpstan-ignore-next-line */
            if ($retry) {
                $retry = false;
                goto retry;
            }
            throw new TokenInvalidException('Token invalid');
        }
        // 响应是一个二进制文件，保存到本地
        $localFile = tempnam(sys_get_temp_dir(), 'feishu_file_');
        // 根据 header 中的 content-type 设置本地文件名和扩展名
        $contentType = $response->getHeader('Content-Type')[0] ?? '';
        $localFile = match ($contentType) {
            'image/jpeg', 'image/jpg' => $localFile . '.jpg',
            'image/png' => $localFile . '.png',
            'image/gif' => $localFile . '.gif',
            'image/webp' => $localFile . '.webp',
            'image/bmp' => $localFile . '.bmp',
            default => $localFile,
        };

        file_put_contents($localFile, $response->getBody()->getContents());
        return $localFile;
    }

    public static function getName(): string
    {
        return 'file';
    }
}
