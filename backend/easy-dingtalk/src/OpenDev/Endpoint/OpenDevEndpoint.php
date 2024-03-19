<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint;

use Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint\Endpoint;
use Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint\EndpointType;
use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidConfigException;
use Dtyq\EasyDingTalk\OpenDev\Api\Oauth2\AccessTokenApi;
use Dtyq\EasyDingTalk\OpenDev\Api\Oauth2\CorpAccessTokenApi;
use Dtyq\EasyDingTalk\OpenDev\Config\OpenDevEndpointConfig;
use GuzzleHttp\RequestOptions;

abstract class OpenDevEndpoint extends Endpoint
{
    protected OpenDevEndpointConfig $openDevConfig;

    public function selectApp(string $appName): void
    {
        $config = $this->sdkBase->getConfig()['applications'][$appName] ?? [];
        if (empty($config)) {
            throw new InvalidConfigException("[{$appName}]Endpoint config not found");
        }

        $endpointType = EndpointType::from($config['type'] ?? '');
        if ($endpointType !== EndpointType::OpenDev) {
            throw new InvalidConfigException("[{$appName}]Endpoint type is not open_dev");
        }

        $this->openDevConfig = new OpenDevEndpointConfig(
            name: $appName,
            type: $endpointType,
            options: $config['options'] ?? []
        );
    }

    protected function getAccessToken(): string
    {
        $appKey = $this->openDevConfig->getAppKey();
        $appSecret = $this->openDevConfig->getAppSecret();
        if (empty($appKey) || empty($appSecret)) {
            throw new InvalidConfigException('app_key or app_secret is empty');
        }

        $cacheKey = 'access-token:' . md5($appKey . $appSecret);
        if ($this->sdkBase->getCache()->has($cacheKey)) {
            return $this->sdkBase->getCache()->get($cacheKey);
        }

        $api = new AccessTokenApi();
        $api->setOptions([
            RequestOptions::JSON => [
                'appKey' => $appKey,
                'appSecret' => $appSecret,
            ],
        ]);
        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        $accessToken = $data['accessToken'] ?? null;
        if (empty($accessToken)) {
            throw new BadRequestException('获取access_token失败');
        }
        $ttl = (int) ($data['expiresIn'] ?? 7200);

        $this->sdkBase->getCache()->set($cacheKey, $accessToken, $ttl);

        return $accessToken;
    }

    protected function getCorpAccessToken(string $corpId, string $suitTicket): string
    {
        $suiteKey = $this->openDevConfig->getAppKey();
        $suiteSecret = $this->openDevConfig->getAppSecret();
        if (empty($suiteKey) || empty($suiteSecret)) {
            throw new InvalidConfigException('app_key or app_secret is empty');
        }
        if (empty($corpId) || empty($suitTicket)) {
            throw new InvalidConfigException('corp_id or suit_ticket is empty');
        }

        $cacheKey = 'corp-access-token:' . md5($suiteKey . $suiteSecret . $corpId . $suitTicket);
        if ($this->sdkBase->getCache()->has($cacheKey)) {
            return $this->sdkBase->getCache()->get($cacheKey);
        }

        $api = new CorpAccessTokenApi();
        $api->setOptions([
            RequestOptions::JSON => [
                'suiteKey' => $suiteKey,
                'suiteSecret' => $suiteSecret,
                'authCorpId' => $corpId,
                'suiteTicket' => $suitTicket,
            ],
        ]);
        $response = $this->send($api);
        $data = json_decode($response->getBody()->getContents(), true);
        $accessToken = $data['accessToken'] ?? null;
        if (empty($accessToken)) {
            throw new BadRequestException('获取corp_access_token失败');
        }
        $ttl = (int) ($data['expiresIn'] ?? 7200);

        $this->sdkBase->getCache()->set($cacheKey, $accessToken, $ttl);

        return $accessToken;
    }
}
