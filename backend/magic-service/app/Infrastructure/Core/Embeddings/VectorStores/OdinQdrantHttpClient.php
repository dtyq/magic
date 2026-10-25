<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Embeddings\VectorStores;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\RequestOptions;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Qdrant\Connection\ClientInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Config\config;

class OdinQdrantHttpClient implements ClientInterface
{
    protected Client $client;

    protected LoggerInterface $logger;

    private string $baseUri;

    public function __construct()
    {
        $this->logger = di(LoggerFactory::class)->get('vector-index-qdrant');
        $config = config('magic_flows.vector.odin_qdrant');

        if (empty($config['base_uri'])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'qdrant error | base_uri is required');
        }
        $this->baseUri = rtrim((string) $config['base_uri'], '/');

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
        try {
            $result = $this->client->request($method, $uri, $body);
        } catch (RequestException $exception) {
            $response = $exception->getResponse();
            $this->logger->error('Qdrant HTTP request failed', [
                'method' => $method,
                'uri' => (string) $uri,
                'target_url' => $this->baseUri . '/' . ltrim((string) $uri, '/'),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'status_code' => $response?->getStatusCode(),
                'response_body' => $response === null
                    ? null
                    : mb_substr((string) $response->getBody(), 0, 500),
            ]);
            throw $exception;
        } catch (Throwable $throwable) {
            $this->logger->error('Qdrant HTTP request failed', [
                'method' => $method,
                'uri' => (string) $uri,
                'target_url' => $this->baseUri . '/' . ltrim((string) $uri, '/'),
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            throw $throwable;
        }

        $result = Json::decode($result->getBody()->getContents());
        if ($result['status'] !== 'ok') {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'qdrant error | ' . $result['status']['error']);
        }
        return $result['result'];
    }
}
