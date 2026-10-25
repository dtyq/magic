<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Contract;

/**
 * 第三方资产能力契约；应用层不依赖具体厂商 SDK。
 */
interface AssetProviderInterface
{
    /**
     * 创建合规资产。
     *
     * 返回里的 metadata 约定放第三方原始响应，由仓储落进映射表的审计列。
     *
     * @param array $payload 领域实体字段 + group_id / project_name / file_url
     * @return array{provider_asset_id?: string, provider_status?: string, metadata?: array}
     */
    public function createAsset(array $payload): array;

    /**
     * 查询第三方资产状态，返回结构与 createAsset 一致。
     *
     * 素材归属第三方项目，定位时带上 project_name；实现可对它取默认值。
     */
    public function getAssetStatus(string $providerAssetId, ?string $projectName = null): array;

    /**
     * 从厂商原始响应中提取合规失败原因，供领域层写入本地失败原因。
     *
     * @param array<string, mixed> $metadata
     */
    public function extractComplianceFailedReason(array $metadata, string $providerStatus): string;

    /**
     * 创建第三方素材组，素材必须归属于素材组。
     *
     * @return array{provider_group_id?: string, provider_status?: string, metadata?: array}
     */
    public function createAssetGroup(array $payload): array;

    /**
     * 幂等删除第三方素材：资源已不存在时视为成功，便于失败补偿重复执行。
     * 返回 false 表示删除确实失败，调用方只需记录日志，不得据此覆盖原始业务异常。
     */
    public function deleteAsset(string $providerAssetId, string $projectName): bool;

    /**
     * 幂等删除第三方素材组，语义与 deleteAsset 一致。
     */
    public function deleteAssetGroup(string $groupId, string $projectName): bool;

    /**
     * 当前适配器在映射表 magic_asset_provider_assets 中使用的 provider 标识。
     */
    public function getProviderCode(): string;
}
