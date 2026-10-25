<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization\Discovery;

use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\RequestOptions;
use RuntimeException;

/**
 * MCP Protected Resource Metadata 和 Authorization Server Metadata 发现客户端。
 */
class MCPAuthorizationDiscoveryClient
{
    public function __construct(
        private readonly ClientInterface $httpClient
    ) {
    }

    /**
     * 发现 MCP 资源对应的授权服务器元数据。
     *
     * @return array<string, mixed>
     */
    public function discover(string $resource, ?string $resourceMetadataUrl = null, ?string $authorizationServerUrl = null): array
    {
        $protectedResource = [];
        try {
            $protectedResource = $this->fetchFirstJson(array_filter([
                $resourceMetadataUrl,
                ...$this->buildProtectedResourceMetadataUrls($resource),
            ]));
        } catch (GuzzleException|RuntimeException) {
            if ($authorizationServerUrl === null || $authorizationServerUrl === '') {
                throw new RuntimeException('MCP protected resource metadata was not discovered');
            }
        }

        $issuers = [];
        if (is_array($protectedResource['authorization_servers'] ?? null)) {
            $issuers = array_values(array_filter($protectedResource['authorization_servers'], 'is_string'));
        }
        if ($authorizationServerUrl !== null && $authorizationServerUrl !== '') {
            array_unshift($issuers, $authorizationServerUrl);
        }
        $issuers = array_values(array_unique($issuers));
        if ($issuers === []) {
            throw new RuntimeException('MCP authorization server was not discovered');
        }

        foreach ($issuers as $issuer) {
            foreach ($this->buildAuthorizationServerMetadataUrls($issuer) as $metadataUrl) {
                try {
                    $metadata = $this->fetchJson($metadataUrl);
                    if (($metadata['issuer'] ?? null) !== $issuer) {
                        throw new RuntimeException('Authorization server issuer mismatch');
                    }
                    return [
                        'resource_metadata' => $protectedResource,
                        'authorization_server' => $metadata,
                        'issuer' => $issuer,
                    ];
                } catch (GuzzleException|RuntimeException) {
                    continue;
                }
            }
        }

        throw new RuntimeException('MCP authorization server metadata was not discovered');
    }

    /**
     * 构造 RFC 9728 资源元数据候选地址。
     *
     * @return array<int, string>
     */
    private function buildProtectedResourceMetadataUrls(string $resource): array
    {
        $parts = parse_url($resource);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return [];
        }
        $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
        $path = $parts['path'] ?? '';
        $path = '/' . ltrim($path, '/');
        return array_values(array_unique([
            $origin . '/.well-known/oauth-protected-resource' . ($path === '/' ? '' : $path),
            $origin . '/.well-known/oauth-protected-resource',
        ]));
    }

    /**
     * 构造 RFC 8414 和 OIDC Discovery 候选地址。
     *
     * @return array<int, string>
     */
    private function buildAuthorizationServerMetadataUrls(string $issuer): array
    {
        $issuer = rtrim($issuer, '/');
        $parts = parse_url($issuer);
        $urls = [
            $issuer . '/.well-known/oauth-authorization-server',
            $issuer . '/.well-known/openid-configuration',
        ];
        if (is_array($parts) && ! empty($parts['scheme']) && ! empty($parts['host'])) {
            $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
            $path = trim((string) ($parts['path'] ?? ''), '/');
            if ($path !== '') {
                $urls[] = $origin . '/.well-known/oauth-authorization-server/' . $path;
                $urls[] = $origin . '/.well-known/openid-configuration/' . $path;
            }
        }
        return array_values(array_unique($urls));
    }

    /**
     * 按顺序读取第一个可用 JSON 文档。
     *
     * @param array<int, string> $urls
     * @return array<string, mixed>
     */
    private function fetchFirstJson(array $urls): array
    {
        foreach (array_values(array_unique($urls)) as $url) {
            try {
                return $this->fetchJson($url);
            } catch (GuzzleException|RuntimeException) {
                continue;
            }
        }
        throw new RuntimeException('MCP protected resource metadata was not discovered');
    }

    /**
     * 请求并解析 JSON metadata。
     *
     * @return array<string, mixed>
     */
    private function fetchJson(string $url): array
    {
        $response = $this->httpClient->request('GET', $url, [
            RequestOptions::HEADERS => ['Accept' => 'application/json'],
            RequestOptions::TIMEOUT => 15,
            RequestOptions::CONNECT_TIMEOUT => 5,
        ]);
        $data = json_decode((string) $response->getBody(), true);
        if (! is_array($data)) {
            throw new RuntimeException('Invalid authorization metadata response');
        }
        return $data;
    }
}
