<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Weather\Adapter;

use App\Infrastructure\ExternalAPI\Weather\Response\WeatherForecastResponse;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use RuntimeException;

class AiDataWeatherAdapter implements WeatherAdapterInterface
{
    private Client $client;

    private string $apiKey;

    private string $baseUrl;

    public function __construct(array $config = [])
    {
        $this->apiKey = $config['api_key'] ?? '';
        $this->baseUrl = rtrim($config['base_url'] ?? 'https://aidata.vip', '/');
        $this->client = new Client([
            'base_uri' => $this->baseUrl,
            'timeout' => 30,
        ]);
    }

    public function forecast(string $location, int $days = 3, string $language = 'zh'): WeatherForecastResponse
    {
        $days = max(1, min(7, $days));

        try {
            $response = $this->client->get('/api/v1/data/weather/forecast', [
                'query' => [
                    'location' => $location,
                    'days' => $days,
                    'language' => $language,
                ],
                'headers' => [
                    'Accept' => 'application/json',
                    'Authorization' => 'Bearer ' . $this->apiKey,
                ],
            ]);

            $body = json_decode($response->getBody()->getContents(), true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new RuntimeException('Failed to parse weather API response');
            }

            return WeatherForecastResponse::fromArray($body['data'] ?? $body);
        } catch (GuzzleException $e) {
            throw new RuntimeException('Weather API request failed: ' . $e->getMessage(), 0, $e);
        }
    }

    public function getDriverName(): string
    {
        return 'aidata';
    }

    public function isAvailable(): bool
    {
        return ! empty($this->apiKey);
    }
}
