<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VolcengineArk\Assets;

use App\Domain\Asset\Contract\AssetProviderInterface;
use App\ErrorCode\AssetErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Guzzle\ClientFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 火山方舟 Assets 适配器：将厂商字段转换为领域契约，不感知本地文件服务。
 */
final class VolcengineArkAssetProvider implements AssetProviderInterface
{
    /** 映射表 magic_asset_provider_assets.provider_code 使用的标识。 */
    public const string PROVIDER_CODE = 'VolcengineArk';

    /** 火山当前只支持 AIGC 类型素材组（虚拟人像素材）。 */
    private const string GROUP_TYPE = 'AIGC';

    private const string DEFAULT_PROJECT_NAME = 'default';

    /** 火山以「资源不存在」类错误码回应删除请求时，说明目标已不存在，按幂等成功处理。 */
    private const array MISSING_RESOURCE_CODE_KEYWORDS = ['notfound', 'notexist', 'nosuch'];

    private readonly VolcengineArkAssetsClient $client;

    /**
     * 凭证由调用方（AssetDomainService）从 AI 能力「火山方舟素材服务」读取后传入，
     * 适配器只负责把配置转交客户端并做字段映射。
     *
     * @param array<string, mixed> $config 素材服务配置，缺省时客户端回落到默认 endpoint/region
     */
    public function __construct(
        private readonly LoggerInterface $logger,
        private readonly array $config = [],
    ) {
        $this->client = new VolcengineArkAssetsClient(
            di()->get(ClientFactory::class),
            $this->logger,
            $this->config,
        );
    }

    public function createAsset(array $payload): array
    {
        $request = $this->toArkPayload($payload);
        $this->logger->info('火山方舟资产创建调用', [
            'group_id' => $request['GroupId'] ?? '',
            'asset_type' => $request['AssetType'] ?? '',
        ]);
        // 保留 HTTP 4xx 的原始错误体，以便把方舟返回的审核原因写入本地记录。
        $response = $this->client->requestAllowingBusinessFailure('CreateAsset', $request);
        if (isset($response['ResponseMetadata']['Error'])) {
            $reason = $this->extractComplianceFailedReason($response, 'FAILED');
            throw new BusinessException($reason, AssetErrorCode::COMPLIANCE_FAILED->value);
        }
        return $this->mapAssetResponse($response);
    }

    public function getAssetStatus(string $providerAssetId, ?string $projectName = null): array
    {
        $this->logger->info('火山方舟资产状态查询', ['provider_asset_id' => $providerAssetId]);
        $request = ['Id' => $providerAssetId];
        if ($projectName !== null && trim($projectName) !== '') {
            $request['ProjectName'] = $projectName;
        }
        return $this->mapAssetResponse($this->client->getAsset($request));
    }

    /**
     * 从火山方舟原始响应中提取合规未通过的原因。
     * 火山的审核信息没有稳定契约，按已知键、整体 JSON、状态三级降级。
     *
     * @param array<string, mixed> $metadata
     */
    public function extractComplianceFailedReason(array $metadata, string $providerStatus): string
    {
        // 方舟参数或审核失败时，优先展示厂商返回的错误码和错误消息。
        $error = $metadata['ResponseMetadata']['Error'] ?? null;
        $errorCode = is_array($error) ? trim((string) ($error['Code'] ?? '')) : '';
        $errorMessage = is_array($error) ? trim((string) ($error['Message'] ?? '')) : '';
        if ($errorCode !== '' && $errorMessage !== '') {
            return $errorCode . '：' . $errorMessage;
        }
        if ($errorMessage !== '') {
            return $errorMessage;
        }
        $moderation = $metadata['Result']['Moderation'] ?? $metadata['Moderation'] ?? null;
        $detail = '';
        if (is_string($moderation)) {
            $detail = trim($moderation);
        } elseif (is_array($moderation)) {
            foreach (['Reason', 'Message', 'Result', 'Strategy'] as $key) {
                $candidate = $moderation[$key] ?? null;
                if (is_string($candidate) && trim($candidate) !== '') {
                    $detail = trim($candidate);
                    break;
                }
            }
            if ($detail === '' && $moderation !== []) {
                $encoded = json_encode($moderation, JSON_UNESCAPED_UNICODE);
                $detail = is_string($encoded) ? $encoded : '';
            }
        }
        if ($detail !== '') {
            return $detail;
        }
        return sprintf('第三方素材合规校验未通过（provider_status=%s）', $providerStatus);
    }

    public function createAssetGroup(array $payload): array
    {
        $request = $this->toArkGroupPayload($payload);
        $this->logger->info('火山方舟素材组创建调用', [
            'name' => $request['Name'],
            'group_type' => $request['GroupType'],
        ]);
        return $this->mapGroupResponse($this->client->createAssetGroup($request));
    }

    public function getProviderCode(): string
    {
        return self::PROVIDER_CODE;
    }

    public function projectName(): string
    {
        return trim((string) ($this->config['project_name'] ?? '')) ?: self::DEFAULT_PROJECT_NAME;
    }

    public function getAsset(array $payload): array
    {
        return $this->mapAssetResponse($this->client->getAsset($payload));
    }

    public function listAssets(array $payload = []): array
    {
        return $this->client->listAssets($payload);
    }

    public function updateAsset(array $payload): array
    {
        return $this->client->request('UpdateAsset', $payload);
    }

    public function deleteAsset(string $providerAssetId, string $projectName): bool
    {
        return $this->deleteIdempotently('DeleteAsset', $providerAssetId, $projectName, '素材');
    }

    public function deleteAssetGroup(string $groupId, string $projectName): bool
    {
        return $this->deleteIdempotently('DeleteAssetGroup', $groupId, $projectName, '素材组');
    }

    /**
     * @return array<string, mixed>
     */
    private function toArkPayload(array $payload): array
    {
        $request = [];
        $request['GroupId'] = $payload['group_id'] ?? $payload['GroupId'] ?? '';
        // file_url 由应用层用文件服务解析后传入，适配器不感知本地存储与存储桶。
        $request['URL'] = $payload['file_url'] ?? $payload['url'] ?? $payload['URL'] ?? '';
        if ($request['URL'] === '') {
            // 用业务错误码返回，避免文件链接缺失时抛出未处理异常导致 500。
            ExceptionBuilder::throw(AssetErrorCode::FILE_REQUIRED);
        }
        $mediaType = strtoupper((string) ($payload['asset_media_type'] ?? ''));
        $request['AssetType'] = match ($mediaType) {
            'VIDEO' => 'Video',
            'AUDIO' => 'Audio',
            'IMAGE' => 'Image',
            default => ucfirst(strtolower((string) ($payload['asset_type'] ?? $payload['AssetType'] ?? 'Image'))),
        };
        $request['ProjectName'] = $payload['project_name'] ?? $payload['ProjectName'] ?? self::DEFAULT_PROJECT_NAME;
        foreach (['Name', 'Description'] as $field) {
            if (isset($payload[$field])) {
                $request[$field] = $payload[$field];
            }
        }
        return $request;
    }

    /**
     * 火山 CreateAssetGroup 只接受 Name/Description/GroupType/ProjectName，Name 必填。
     */
    private function toArkGroupPayload(array $payload): array
    {
        return [
            'Name' => (string) ($payload['name'] ?? $payload['Name'] ?? ''),
            'Description' => (string) ($payload['description'] ?? $payload['Description'] ?? ''),
            'GroupType' => (string) ($payload['group_type'] ?? $payload['GroupType'] ?? self::GROUP_TYPE),
            'ProjectName' => (string) ($payload['project_name'] ?? $payload['ProjectName'] ?? self::DEFAULT_PROJECT_NAME),
        ];
    }

    /**
     * 幂等删除：缺少 ID 或资源已不存在都返回 true，真实失败返回 false 并留日志。
     * 补偿链路按布尔值决策，因此这里不允许向调用方抛异常。
     */
    private function deleteIdempotently(string $action, string $id, string $projectName, string $label): bool
    {
        $id = trim($id);
        if ($id === '') {
            return true;
        }
        $payload = ['Id' => $id];
        if (trim($projectName) !== '') {
            $payload['ProjectName'] = $projectName;
        }
        try {
            $response = $this->client->requestAllowingBusinessFailure($action, $payload);
        } catch (Throwable $throwable) {
            $this->logger->error('火山方舟资源回收调用异常', [
                'action' => $action,
                'id' => $id,
                'exception' => $throwable::class,
                'message' => $throwable->getMessage(),
            ]);
            return false;
        }
        $errorCode = $this->extractErrorCode($response);
        if ($errorCode === '') {
            $this->logger->info('火山方舟资源回收成功', [
                'action' => $action,
                'id' => $id,
                'resource' => $label,
            ]);
            return true;
        }
        if ($this->isMissingResourceCode($errorCode)) {
            $this->logger->info('火山方舟资源已不存在，按回收成功处理', [
                'action' => $action,
                'id' => $id,
                'resource' => $label,
                'error_code' => $errorCode,
            ]);
            return true;
        }
        $this->logger->error('火山方舟资源回收失败', [
            'action' => $action,
            'id' => $id,
            'resource' => $label,
            'error_code' => $errorCode,
        ]);
        return false;
    }

    /**
     * 从 ResponseMetadata.Error.Code 提取火山业务错误码。
     */
    private function extractErrorCode(array $response): string
    {
        $error = $response['ResponseMetadata']['Error'] ?? null;
        return is_array($error) ? trim((string) ($error['Code'] ?? '')) : '';
    }

    private function isMissingResourceCode(string $errorCode): bool
    {
        $normalized = strtolower(str_replace(['_', '-'], '', $errorCode));
        foreach (self::MISSING_RESOURCE_CODE_KEYWORDS as $keyword) {
            if (str_contains($normalized, $keyword)) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function mapAssetResponse(array $response): array
    {
        $result = $this->extractResult($response);
        $id = $result['Id'] ?? $result['ID'] ?? $result['id'] ?? '';
        $status = strtoupper((string) ($result['Status'] ?? $result['status'] ?? ''));
        return [
            'provider_asset_id' => (string) $id,
            'provider_status' => match ($status) {
                'ACTIVE' => 'PASS',
                'PROCESSING' => 'PROCESSING',
                'FAILED' => 'FAILED',
                default => 'PROCESSING',
            },
            'metadata' => $response,
        ];
    }

    /**
     * 素材组创建后即可直接挂载素材，因此固定按 PASS 返回。
     */
    private function mapGroupResponse(array $response): array
    {
        $result = $this->extractResult($response);
        $id = $result['Id'] ?? $result['ID'] ?? $result['id'] ?? '';
        return [
            'provider_group_id' => (string) $id,
            'provider_status' => 'PASS',
            'metadata' => $response,
        ];
    }

    /**
     * 兼容 Result 包装、data 包装和直接返回三种响应形态。
     */
    private function extractResult(array $response): array
    {
        if (is_array($response['Result'] ?? null)) {
            return $response['Result'];
        }
        return is_array($response['data'] ?? null) ? $response['data'] : $response;
    }
}
