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
use Hyperf\Codec\Json;

use function Hyperf\Translation\__;

/**
 * MiniMax LLM connectivity test provider.
 *
 * Unlike the DeepSeek provider which only lists models, this provider
 * validates connectivity by sending a lightweight chat completion request
 * with the specified model version (similar to LLMVolcengineProvider).
 * MiniMax requires temperature in (0.0, 1.0], so we clamp it explicitly.
 */
class LLMMiniMaxProvider implements IProvider
{
    protected string $apiBase = 'https://api.minimax.io/v1';

    public function connectivityTestByModel(ProviderConfigItem $serviceProviderConfig, string $modelVersion): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $connectResponse->setStatus(true);
        $apiKey = $serviceProviderConfig->getApiKey();
        if (empty($apiKey)) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage(__('service_provider.api_key_empty'));
            return $connectResponse;
        }
        try {
            $this->testChatCompletion($apiKey, $modelVersion);
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

    /**
     * Test connectivity by sending a minimal chat completion request.
     *
     * This validates both the API key and that the specific model version
     * is accessible, rather than just listing available models.
     * MiniMax requires temperature strictly in (0.0, 1.0].
     */
    protected function testChatCompletion(string $apiKey, string $modelVersion): array
    {
        $client = new Client();
        $payload = [
            'model' => $modelVersion,
            'max_tokens' => 1,
            'temperature' => 0.01,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => 'Hi',
                ],
            ],
        ];

        $response = $client->request('POST', $this->apiBase . '/chat/completions', [
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ],
            'json' => $payload,
        ]);

        return Json::decode($response->getBody()->getContents());
    }
}
