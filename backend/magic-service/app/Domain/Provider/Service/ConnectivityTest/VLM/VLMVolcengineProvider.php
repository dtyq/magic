<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ConnectivityTest\VLM;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ConnectivityTest\IProvider;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine\VolcengineAPI;
use Exception;
use GuzzleHttp\Exception\ClientException;
use Hyperf\Codec\Json;

use function Hyperf\Translation\__;

/**
 * 火山服务商.
 */
class VLMVolcengineProvider implements IProvider
{
    public function __construct()
    {
    }

    public function connectivityTestByModel(ProviderConfigItem $serviceProviderConfig, string $modelVersion): ConnectResponse
    {
        $connectResponse = new ConnectResponse();

        $ak = $serviceProviderConfig->getAk();
        $sk = $serviceProviderConfig->getSk();

        if (empty($ak) || empty($sk)) {
            $connectResponse->setMessage(__('service_provider.ak_sk_empty'));
            $connectResponse->setStatus(false);
            return $connectResponse;
        }
        $volcengineAPI = new VolcengineAPI($ak, $sk);
        $body = [];
        // 文生图配置
        $body['req_key'] = $modelVersion;
        $body['model_version'] = 'general_v2.1_L'; // 先写死没问题的，目前的文生图支持这个值，图生图没这个值
        $body['width'] = 512;
        $body['height'] = 512;
        $body['prompt'] = '生成一只狗';
        try {
            $volcengineAPI->submitTask($body);
        } catch (Exception $e) {
            $connectResponse->setStatus(false);
            if ($e instanceof ClientException) {
                $connectResponse->setMessage(Json::decode($e->getResponse()->getBody()->getContents()));
            } else {
                $connectResponse->setMessage($e->getMessage());
            }
        }
        return $connectResponse;
    }
}
