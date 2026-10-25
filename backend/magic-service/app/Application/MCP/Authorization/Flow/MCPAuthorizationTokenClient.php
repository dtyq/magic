<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization\Flow;

use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use GuzzleHttp\Client;
use GuzzleHttp\RequestOptions;
use RuntimeException;

/**
 * MCP Authorization Token endpoint 客户端。
 */
class MCPAuthorizationTokenClient
{
    public function __construct(
        private readonly Client $httpClient
    ) {
    }

    /**
     * 使用授权码交换 Token。
     *
     * @return array<string, mixed>
     */
    public function exchangeCode(
        string $tokenEndpoint,
        MCPAuthorizationConfig $config,
        string $code,
        string $redirectUri,
        string $codeVerifier,
        string $resource
    ): array {
        return $this->request($tokenEndpoint, $config, [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $redirectUri,
            'code_verifier' => $codeVerifier,
            'resource' => $resource,
        ]);
    }

    /**
     * 使用 refresh token 更新访问令牌。
     *
     * @return array<string, mixed>
     */
    public function refresh(
        string $tokenEndpoint,
        MCPAuthorizationConfig $config,
        string $refreshToken,
        string $resource
    ): array {
        return $this->request($tokenEndpoint, $config, [
            'grant_type' => 'refresh_token',
            'refresh_token' => $refreshToken,
            'resource' => $resource,
        ]);
    }

    /**
     * 构造并发送符合 OAuth 2.1 的 form-urlencoded Token 请求。
     *
     * @param array<string, string> $params
     * @return array<string, mixed>
     */
    private function request(string $tokenEndpoint, MCPAuthorizationConfig $config, array $params): array
    {
        $params['client_id'] = $config->getClientId();
        $method = $config->getTokenEndpointAuthMethod() ?: (! empty($config->getClientSecret()) ? 'client_secret_basic' : 'none');
        $options = [
            RequestOptions::FORM_PARAMS => $params,
            RequestOptions::HEADERS => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/x-www-form-urlencoded',
            ],
            RequestOptions::TIMEOUT => 30,
            RequestOptions::CONNECT_TIMEOUT => 10,
        ];

        if ($method === 'client_secret_basic') {
            $options[RequestOptions::AUTH] = [$config->getClientId(), $config->getClientSecret()];
            unset($options[RequestOptions::FORM_PARAMS]['client_id']);
        } elseif ($method === 'client_secret_post') {
            $options[RequestOptions::FORM_PARAMS]['client_secret'] = $config->getClientSecret();
        } elseif ($method !== 'none') {
            throw new RuntimeException('Unsupported token endpoint authentication method: ' . $method);
        }

        $response = $this->httpClient->request('POST', $tokenEndpoint, $options);
        $data = json_decode((string) $response->getBody(), true);
        if (! is_array($data) || empty($data['access_token'])) {
            throw new RuntimeException('OAuth token response does not contain access_token');
        }
        return $data;
    }
}
