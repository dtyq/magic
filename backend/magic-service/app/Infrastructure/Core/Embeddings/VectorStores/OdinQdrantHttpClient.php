<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;
use Hyperf\Codec\Json;
use Hyperf\Qdrant\Connection\ClientInterface;

use function Hyperf\Config\config;

class OdinQdrantHttpClient implements ClientInterface
{
    protected Client $client;

    public function __construct()
    {
        $config = config('magic_flows.vector.odin_qdrant');

        if (empty($config['base_uri'])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'qdrant error | base_uri is required');
        }

        $headers = [
            'Content-Type' => 'application/json',
        ];
        if (! empty($config['api_key'])) {
            $headers['api-key'] = $config['api_key'];
        }

        $this->client = new Client([
            'base_uri' => $config['base_uri'],
            RequestOptions::HEADERS => $headers,
            'timeout' => 5,
        ]);
    }

    public function request(string $method, $uri, ?array $body = null): mixed
    {
        $body = $body ? [RequestOptions::JSON => $body] : [];
        $result = $this->client->request($method, $uri, $body);

        $result = Json::decode($result->getBody()->getContents());
        if ($result['status'] !== 'ok') {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'qdrant error | ' . $result['status']['error']);
        }
        return $result['result'];
    }
}
