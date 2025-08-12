<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ConnectivityTest\LLM;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ConnectivityTest\IProvider;
use Exception;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\ConnectException;

class LLMMicrosoftAzureProvider implements IProvider
{
    public function __construct()
    {
    }

    public function connectivityTestByModel(ProviderConfigItem $serviceProviderConfig, string $modelVersion): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        try {
            $apiKey = $serviceProviderConfig->getApiKey();
            $apiBase = $serviceProviderConfig->getUrl();
            $apiVersion = $serviceProviderConfig->getApiVersion();

            $client = new Client();

            $client->request('GET', rtrim('https://' . $apiBase, '/') . '/openai/models', [
                'headers' => [
                    'api-key' => $apiKey,
                    'Content-Type' => 'application/json',
                ],
                'query' => [
                    'api-version' => $apiVersion,
                ],
            ]);
        } catch (ClientException|ConnectException|Exception $e) {
            // 判断各类型特殊取值
            if ($e instanceof ClientException) {
                $connectResponse->setStatus(false);
                $connectResponse->setMessage($e->getResponse()->getBody()->getContents());
            } else {
                $connectResponse->setMessage($e->getMessage());
            }
            $connectResponse->setStatus(false);
            return $connectResponse;
        }
        return $connectResponse;
    }
}
