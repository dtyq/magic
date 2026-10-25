<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VolcengineArk\Assets;

use DateTimeImmutable;
use GuzzleHttp\Client;
use Hyperf\Guzzle\ClientFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;
use Volcengine\Common\Utils;

use function Hyperf\Translation\trans;

/**
 * 火山方舟 Ark Assets 接口客户端：承载素材 / 素材组两个资源族的 10 个 OpenAPI Action。
 *
 * 客户端只负责签名与请求，不感知配置来源：凭证由调用方从 AI 能力「火山方舟素材服务」读取后注入。
 */
class VolcengineArkAssetsClient
{
    private const array SUPPORTED_ACTIONS = [
        'CreateAssetGroup', 'CreateAsset', 'GetAsset', 'ListAssets',
        'GetAssetGroup', 'ListAssetGroups', 'UpdateAsset', 'UpdateAssetGroup',
        'DeleteAsset', 'DeleteAssetGroup',
    ];

    private const int REQUEST_TIMEOUT_SECONDS = 30;

    /**
     * 接入坐标的默认值：管理端把这几个字段配置为可留空，留空时必须与「从未配置」等价。
     */
    private const string DEFAULT_ENDPOINT = 'https://open.volcengineapi.com';

    private const string DEFAULT_VERSION = '2024-01-01';

    private const string DEFAULT_REGION = 'cn-beijing';

    private const string DEFAULT_SERVICE = 'ark';

    /**
     * @param array<string, mixed> $config 素材服务配置（endpoint/region/version/service/access_key/secret_key），
     *                                     由 `AssetDomainService` 从 AI 能力「火山方舟素材服务」读取后传入
     */
    public function __construct(
        private readonly ClientFactory $clientFactory,
        private LoggerInterface $logger,
        private readonly array $config = [],
    ) {
    }

    /**
     * @param array<string, mixed> $payload @return array<string, mixed>
     */
    public function request(string $action, array $payload): array
    {
        return $this->execute($action, $payload, true);
    }

    /**
     * 允许业务失败的请求：HTTP 4xx/5xx 不抛异常，返回原始响应体，由调用方按
     * ResponseMetadata.Error.Code 自行判断。仅供删除类幂等操作使用——已不存在的资源在
     * 火山侧同样返回 4xx，补偿链路必须能区分「已删干净」与「真的删失败」。
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function requestAllowingBusinessFailure(string $action, array $payload): array
    {
        return $this->execute($action, $payload, false);
    }

    /**
     * @param array<string, mixed> $payload @return array{url: string, headers: array<string, string>, body: string}
     */
    public function buildRequest(string $action, array $payload, ?DateTimeImmutable $date = null): array
    {
        $this->validateConfig();
        if (! in_array($action, self::SUPPORTED_ACTIONS, true)) {
            throw new InvalidArgumentException(trans('asset.provider_action_unsupported'));
        }
        $config = $this->config;
        $endpoint = rtrim($this->configValue('endpoint', self::DEFAULT_ENDPOINT), '/');
        $parts = parse_url($endpoint);
        $host = (string) ($parts['host'] ?? 'open.volcengineapi.com');
        if (isset($parts['port'])) {
            $host .= ':' . $parts['port'];
        }
        // 与火山 SDK 的 BuildRequestInterceptor 保持一致，使用默认 JSON 编码参与签名。
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        // 使用火山 SDK 官方 signv4 实现，确保 content-type 等官方要求的请求头参与签名。
        $query = ['Action' => $action, 'Version' => $this->configValue('version', self::DEFAULT_VERSION)];
        $queryString = http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        $signedHeaders = Utils::signv4(
            (string) $config['access_key'],
            (string) $config['secret_key'],
            $this->configValue('region', self::DEFAULT_REGION),
            $this->configValue('service', self::DEFAULT_SERVICE),
            $body,
            $queryString,
            'POST',
            '/',
            ['Content-Type' => 'application/json', 'Host' => $host],
        );
        return [
            'url' => $endpoint . '/?' . $queryString,
            'headers' => array_map(static fn ($value): string => is_array($value) ? implode(',', $value) : (string) $value, $signedHeaders),
            'body' => $body,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function createAssetGroup(array $payload): array
    {
        return $this->request('CreateAssetGroup', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function createAsset(array $payload): array
    {
        return $this->request('CreateAsset', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function getAsset(array $payload): array
    {
        return $this->request('GetAsset', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function listAssets(array $payload): array
    {
        return $this->request('ListAssets', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function getAssetGroup(array $payload): array
    {
        return $this->request('GetAssetGroup', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function listAssetGroups(array $payload): array
    {
        return $this->request('ListAssetGroups', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function deleteAsset(array $payload): array
    {
        return $this->request('DeleteAsset', $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function deleteAssetGroup(array $payload): array
    {
        return $this->request('DeleteAssetGroup', $payload);
    }

    /**
     * @param array<string, mixed> $payload @return array<string, mixed>
     */
    private function execute(string $action, array $payload, bool $throwOnBusinessError): array
    {
        // 先打日志再构建请求：buildRequest 会做配置校验和签名，任何一步失败都必须留下可排查的记录。
        $this->logger->info('开始调用火山方舟 Assets 接口', [
            'action' => $action,
            'payload_keys' => array_keys($payload),
        ]);
        $request = [];
        try {
            $request = $this->buildRequest($action, $payload);
            $response = $this->createClient()->post($request['url'], [
                'headers' => $request['headers'],
                // 使用 body 确保签名使用的字节与实际发送内容一致。
                'body' => $request['body'],
                'http_errors' => false,
            ]);
            $rawBody = (string) $response->getBody();
            $decoded = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($decoded)) {
                throw new RuntimeException(trans('asset.provider_response_body_invalid'));
            }
            $this->logger->info('火山方舟 Assets 接口调用完成', [
                'action' => $action,
                'http_status' => $response->getStatusCode(),
                'response' => $rawBody,
            ]);
            if ($response->getStatusCode() >= 400 && $throwOnBusinessError) {
                throw new RuntimeException(trans('asset.provider_unavailable'));
            }
            return $decoded;
        } catch (Throwable $exception) {
            $this->logger->error('火山方舟 Assets 接口调用失败', [
                'action' => $action,
                'exception' => $exception::class,
                'error' => $exception->getMessage(),
            ]);
            // 输出可复核的签名元数据，但不输出 AK、SK 或完整 Authorization。
            $this->logger->error('火山方舟 Assets 签名元数据', [
                'action' => $action,
                'url' => $request['url'] ?? '',
                'x_date' => $request['headers']['X-Date'] ?? '',
                'signed_headers' => $this->extractSignedHeaders($request['headers']['Authorization'] ?? ''),
                'body_sha256' => $request['headers']['X-Content-Sha256'] ?? '',
            ]);
            throw $exception;
        }
    }

    /**
     * 读取接入坐标配置：管理端允许这几个字段留空，因此「空字符串」必须与「未配置」等价。
     * 不能用 `??` 兜底——管理端保存空值后键是存在的，`??` 不会走默认分支，签名会带上空 region/service。
     */
    private function configValue(string $key, string $default): string
    {
        $value = trim((string) ($this->config[$key] ?? ''));
        return $value === '' ? $default : $value;
    }

    private function validateConfig(): void
    {
        $config = $this->config;
        if (trim((string) ($config['access_key'] ?? '')) === '') {
            throw new InvalidArgumentException(trans('asset.provider_config_incomplete'));
        }
        if (trim((string) ($config['secret_key'] ?? '')) === '') {
            throw new InvalidArgumentException(trans('asset.provider_config_incomplete'));
        }
    }

    private function createClient(): Client
    {
        return $this->clientFactory->create(['timeout' => self::REQUEST_TIMEOUT_SECONDS]);
    }

    private function extractSignedHeaders(string $authorization): string
    {
        if (preg_match('/SignedHeaders=([^,]+)/', $authorization, $matches) === 1) {
            return $matches[1];
        }
        return '';
    }
}
