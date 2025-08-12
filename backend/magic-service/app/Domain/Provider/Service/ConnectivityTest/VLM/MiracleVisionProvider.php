<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ConnectivityTest\VLM;

use App\Domain\File\Constant\DefaultFileBusinessType;
use App\Domain\File\Service\DefaultFileDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ConnectivityTest\IProvider;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision\MiracleVisionAPI;
use Exception;
use GuzzleHttp\Exception\ClientException;
use Hyperf\Codec\Json;

use function Hyperf\Translation\__;

class MiracleVisionProvider implements IProvider
{
    public function connectivityTestByModel(ProviderConfigItem $serviceProviderConfig, string $modelVersion): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $connectResponse->setStatus(true);

        $ak = $serviceProviderConfig->getAk();
        $sk = $serviceProviderConfig->getSk();

        if (empty($sk) || empty($ak)) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage(__('service_provider.ak_sk_empty'));
            return $connectResponse;
        }

        try {
            $miracleVisionApi = new MiracleVisionAPI($ak, $sk);
            // 搞一张图片 todo xhy
            $url = $this->getImage();
            $miracleVisionApi->submitTask($url, 1);
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

    protected function getImage(): string
    {
        // 随机使用一张图片即可
        $fileKey = di(DefaultFileDomainService::class)->getOnePublicKey(DefaultFileBusinessType::SERVICE_PROVIDER);
        return di(FileDomainService::class)->getLink('', $fileKey)?->getUrl();
    }
}
