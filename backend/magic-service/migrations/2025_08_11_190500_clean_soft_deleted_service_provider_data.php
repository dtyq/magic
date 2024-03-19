<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;
use Hyperf\Context\ApplicationContext;
use Hyperf\Coroutine\Parallel;
use Hyperf\Database\Migrations\Migration;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 清空官方组织的 Magic 服务商配置和模型（放在删除软删除数据之前）
        $this->cleanOfficialMagicProviderData();

        // 清理 service_provider 相关四张表中的软删除数据
        $this->cleanSoftDeletedData();

        // 清洗 service_provider 表中 provider_code='Official' 的记录
        $this->cleanOfficialProviderData();

        // 清理 service_provider_models 表中的冗余数据
        $this->cleanServiceProviderModelsData();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // 软删除数据一旦物理删除就无法恢复，所以 down 方法为空
    }

    /**
     * 清理 service_provider 相关表中的软删除数据.
     */
    private function cleanSoftDeletedData(): void
    {
        $logger = $this->getLogger();
        $logger->info('开始清理 service_provider 相关表的软删除数据');

        try {
            // 使用事务确保数据一致性
            Db::transaction(function () use ($logger) {
                $totalDeleted = 0;

                // 1. 删除 service_provider 表中软删除的数据
                $deletedCount = Db::table('service_provider')
                    ->whereNotNull('deleted_at')
                    ->delete();
                $totalDeleted += $deletedCount;
                $logger->info("删除 service_provider 表软删除数据: {$deletedCount} 条");

                // 2. 删除 service_provider_configs 表中软删除的数据
                $deletedCount = Db::table('service_provider_configs')
                    ->whereNotNull('deleted_at')
                    ->delete();
                $totalDeleted += $deletedCount;
                $logger->info("删除 service_provider_configs 表软删除数据: {$deletedCount} 条");

                // 3. 删除 service_provider_models 表中软删除的数据
                $deletedCount = Db::table('service_provider_models')
                    ->whereNotNull('deleted_at')
                    ->delete();
                $totalDeleted += $deletedCount;
                $logger->info("删除 service_provider_models 表软删除数据: {$deletedCount} 条");

                // 4. 删除 service_provider_original_models 表中软删除的数据
                $deletedCount = Db::table('service_provider_original_models')
                    ->whereNotNull('deleted_at')
                    ->delete();
                $totalDeleted += $deletedCount;
                $logger->info("删除 service_provider_original_models 表软删除数据: {$deletedCount} 条");

                $logger->info("service_provider 相关表软删除数据清理完成，总共删除: {$totalDeleted} 条记录");
            });
        } catch (Throwable $e) {
            $logger->error('清理软删除数据过程中发生错误: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 清空官方组织的 Magic 服务商配置和模型.
     */
    private function cleanOfficialMagicProviderData(): void
    {
        $logger = $this->getLogger();
        $logger->info('开始清空官方组织的 Magic 服务商配置和模型');

        try {
            // 使用事务确保数据一致性
            Db::transaction(function () use ($logger) {
                // 获取官方组织编码
                $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
                $logger->info("官方组织编码: {$officialOrganizationCode}");

                $totalDeleted = 0;

                // 1. 查找官方组织中 Magic 服务商的配置ID
                $magicProviderConfigQuery = Db::table('service_provider_configs as configs')
                    ->join('service_provider as providers', 'configs.service_provider_id', '=', 'providers.id')
                    ->select('configs.id')
                    ->where('configs.organization_code', $officialOrganizationCode)
                    ->where('providers.provider_code', 'Official');

                $magicProviderConfigs = Db::select($magicProviderConfigQuery->toSql(), $magicProviderConfigQuery->getBindings());
                $magicConfigIds = array_column($magicProviderConfigs, 'id');

                if (! empty($magicConfigIds)) {
                    $logger->info('找到 Magic 服务商配置数量: ' . count($magicConfigIds));

                    // 2. 删除官方组织中 Magic 服务商下的模型
                    $deletedModelsCount = Db::table('service_provider_models')
                        ->where('organization_code', $officialOrganizationCode)
                        ->whereIn('service_provider_config_id', $magicConfigIds)
                        ->delete();
                    $totalDeleted += $deletedModelsCount;
                    $logger->info("删除官方组织 Magic 服务商模型: {$deletedModelsCount} 条");

                    // 3. 删除官方组织的 Magic 服务商配置
                    $deletedConfigsCount = Db::table('service_provider_configs')
                        ->where('organization_code', $officialOrganizationCode)
                        ->whereIn('id', $magicConfigIds)
                        ->delete();
                    $totalDeleted += $deletedConfigsCount;
                    $logger->info("删除官方组织 Magic 服务商配置: {$deletedConfigsCount} 条");
                } else {
                    $logger->info('未找到需要清理的 Magic 服务商配置');
                }

                // 4. 额外清理：删除所有 is_office=1 的官方组织模型
                $deletedOfficeModelsCount = Db::table('service_provider_models')
                    ->where('organization_code', $officialOrganizationCode)
                    ->where('is_office', 1)
                    ->delete();
                $totalDeleted += $deletedOfficeModelsCount;
                $logger->info("删除官方组织 Magic 模型(is_office=1): {$deletedOfficeModelsCount} 条");

                $logger->info("官方组织 Magic 服务商数据清理完成，总共删除: {$totalDeleted} 条记录");
            });
        } catch (Throwable $e) {
            $logger->error('清理官方组织 Magic 服务商数据过程中发生错误: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 清洗 Official 服务商的数据.
     */
    private function cleanOfficialProviderData(): void
    {
        $logger = $this->getLogger();
        $logger->info('开始清洗 Official 服务商的 description 和 translate 字段');

        try {
            // 使用事务确保数据一致性
            Db::transaction(function () use ($logger) {
                // 查询需要清洗的 Official 服务商记录
                $query = Db::table('service_provider')
                    ->select(['id', 'description', 'translate'])
                    ->where('provider_code', 'Official');
                $providers = Db::select($query->toSql(), $query->getBindings());

                $updateCount = 0;
                foreach ($providers as $provider) {
                    $needUpdate = false;
                    $updateData = [];

                    // 处理 description 字段
                    if (! empty($provider['description']) && strpos($provider['description'], '!') !== false) {
                        $updateData['description'] = str_replace('!', 'I', $provider['description']);
                        $needUpdate = true;
                    }

                    // 处理 translate 字段
                    if (! empty($provider['translate']) && strpos($provider['translate'], '!') !== false) {
                        $updateData['translate'] = str_replace('!', 'I', $provider['translate']);
                        $needUpdate = true;
                    }

                    // 更新记录
                    if ($needUpdate) {
                        Db::table('service_provider')
                            ->where('id', $provider['id'])
                            ->update($updateData);
                        ++$updateCount;
                    }
                }

                $logger->info("清洗完成，总共影响行数: {$updateCount}");
                $logger->info('Official 服务商数据清洗完成');
            });
        } catch (Throwable $e) {
            $logger->error('数据清洗过程中发生错误: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 清理 service_provider_models 表中的冗余数据.
     */
    private function cleanServiceProviderModelsData(): void
    {
        $logger = $this->getLogger();
        $logger->info('开始清理 service_provider_models 表的冗余数据');

        try {
            // 1. 获取官方组织编码
            $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
            $logger->info("官方组织编码: {$officialOrganizationCode}");

            // 2. 单独事务：重置官方组织模型的 model_parent_id
            $this->resetOfficialModelsParentId($officialOrganizationCode, $logger);

            // 3. 获取官方组织所有启用的模型（不需要事务）
            $officialEnabledModels = Db::table('service_provider_models')
                ->where('organization_code', $officialOrganizationCode)
                ->where('status', Status::Enabled->value)
                ->whereNull('deleted_at')
                ->select(['id', 'status'])
                ->get()
                ->keyBy('id')
                ->toArray();

            $officialModelIds = array_keys($officialEnabledModels);
            $logger->info('获取官方组织启用模型数量: ' . count($officialModelIds));

            // 4. 获取所有非官方组织编码（不需要事务）
            $allOrganizationCodes = Db::table('service_provider_models')
                ->where('organization_code', '!=', $officialOrganizationCode)
                ->whereNull('deleted_at')
                ->distinct()
                ->pluck('organization_code')
                ->toArray();

            $logger->info('需要清理的组织数量: ' . count($allOrganizationCodes));

            // 5. 按组织处理清理工作（小事务）
            $this->cleanOrganizationsInBatches($allOrganizationCodes, $officialModelIds, $officialEnabledModels, $logger);
        } catch (Throwable $e) {
            $logger->error('清理 service_provider_models 冗余数据过程中发生错误: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 重置官方组织模型的 parent_id（单独事务）.
     */
    private function resetOfficialModelsParentId(string $officialOrganizationCode, LoggerInterface $logger): void
    {
        Db::transaction(function () use ($officialOrganizationCode, $logger) {
            $updatedCount = Db::table('service_provider_models')
                ->where('organization_code', $officialOrganizationCode)
                ->where('model_parent_id', '!=', 0)
                ->update(['model_parent_id' => 0]);
            $updatedCount && $logger->info("官方组织模型 model_parent_id 重置为 0: {$updatedCount} 条");
        });
    }

    /**
     * 分批并发清理各个组织的数据（每个组织独立小事务）.
     */
    private function cleanOrganizationsInBatches(array $organizationCodes, array $officialModelIds, array $officialEnabledModels, LoggerInterface $logger): void
    {
        $totalDeleted = 0;
        $totalOrgs = count($organizationCodes);

        // 将组织分批处理，每批最多 5 个组织并发
        $chunks = array_chunk($organizationCodes, 5);

        foreach ($chunks as $chunkIndex => $chunk) {
            $logger->info('开始处理第 ' . ($chunkIndex + 1) . ' 批组织，数量: ' . count($chunk));

            $parallel = new Parallel(10);

            // 添加并发任务
            foreach ($chunk as $organizationCode) {
                $parallel->add(function () use ($organizationCode, $officialModelIds, $officialEnabledModels) {
                    try {
                        return $this->cleanSingleOrganization($organizationCode, $officialModelIds, $officialEnabledModels);
                    } catch (Throwable $e) {
                        return ['error' => $e, 'org_code' => $organizationCode];
                    }
                }, $organizationCode);
            }

            // 执行并发任务并等待结果
            $results = $parallel->wait();

            // 处理结果
            foreach ($results as $orgCode => $result) {
                if (isset($result['error'])) {
                    $logger->error("清理组织 {$orgCode} 时发生错误: " . $result['error']->getMessage());
                } else {
                    $deletedCount = $result['deleted_count'];
                    $totalDeleted += $deletedCount;

                    if ($deletedCount > 0) {
                        $logger->info("组织 {$orgCode} 删除冗余模型: {$deletedCount} 条");
                    }
                }
            }

            $logger->info('第 ' . ($chunkIndex + 1) . ' 批组织处理完成');

            // 每处理一批输出进度
            $processedCount = ($chunkIndex + 1) * 10;
            if ($processedCount > $totalOrgs) {
                $processedCount = $totalOrgs;
            }
            $logger->info("已处理 {$processedCount}/{$totalOrgs} 个组织，累计删除: {$totalDeleted} 条");
        }

        $logger->info("service_provider_models 表冗余数据清理完成，总共删除: {$totalDeleted} 条记录");
    }

    /**
     * 清理单个组织的数据（单独事务）.
     */
    private function cleanSingleOrganization(string $organizationCode, array $officialModelIds, array $officialEnabledModels): array
    {
        return Db::transaction(function () use ($organizationCode, $officialModelIds, $officialEnabledModels) {
            // 获取官方组织编码用于安全防护
            $officialOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();

            // 防护检查：确保不处理官方组织
            if ($organizationCode === $officialOrganizationCode) {
                return ['deleted_count' => 0];
            }

            $totalDeletedCount = 0;

            // 1. 删除所有 is_office = 1 的数据（防护：非官方组织）
            $isOfficeDeletedCount = Db::table('service_provider_models')
                ->where('organization_code', $organizationCode)
                ->where('organization_code', '!=', $officialOrganizationCode) // 双重防护
                ->where('is_office', 1)
                ->whereNull('deleted_at')
                ->delete();
            $totalDeletedCount += $isOfficeDeletedCount;

            // 2. 删除引用不存在配置的模型（批量查询和批量删除）
            $invalidConfigDeletedCount = $this->cleanModelsWithInvalidConfig($organizationCode, $officialOrganizationCode);
            $totalDeletedCount += $invalidConfigDeletedCount;

            // 3. 删除配置无效的模型（配置解密后为空或所有值都是空）
            $invalidConfigDataDeletedCount = $this->cleanModelsWithInvalidConfigData($organizationCode, $officialOrganizationCode);
            $totalDeletedCount += $invalidConfigDataDeletedCount;

            // 4. 查找 model_parent_id 不为 0 的数据
            $modelsWithParent = Db::table('service_provider_models')
                ->where('organization_code', $organizationCode)
                ->where('model_parent_id', '!=', 0)
                ->where('organization_code', '!=', $officialOrganizationCode) // 防护
                ->whereNull('deleted_at')
                ->select(['id', 'model_parent_id', 'status'])
                ->get();

            $deleteIds = [];

            foreach ($modelsWithParent as $model) {
                $parentId = $model['model_parent_id'];

                // 检查 model_parent_id 是否在官方组织的模型 id 中
                if (! in_array($parentId, $officialModelIds)) {
                    // model_parent_id 在官方组织找不到，标记删除
                    $deleteIds[] = $model['id'];
                    continue;
                }

                // 如果 model_parent_id 存在，但状态与官方组织一致，也删除
                $officialModel = $officialEnabledModels[$parentId] ?? null;
                if ($officialModel && $model['status'] == $officialModel['status']) {
                    $deleteIds[] = $model['id'];
                }
            }

            // 5. 批量删除冗余数据（带防护）
            if (! empty($deleteIds)) {
                $redundantDeletedCount = Db::table('service_provider_models')
                    ->whereIn('id', $deleteIds)
                    ->where('organization_code', '!=', $officialOrganizationCode) // 额外防护
                    ->delete();
                $totalDeletedCount += $redundantDeletedCount;
            }

            return ['deleted_count' => $totalDeletedCount];
        });
    }

    /**
     * 清理引用不存在配置的模型（批量查询和批量删除）.
     */
    private function cleanModelsWithInvalidConfig(string $organizationCode, string $officialOrganizationCode): int
    {
        // 1. 批量查询该组织下所有模型的 service_provider_config_id
        $modelConfigs = Db::table('service_provider_models')
            ->where('organization_code', $organizationCode)
            ->where('organization_code', '!=', $officialOrganizationCode) // 防护
            ->whereNull('deleted_at')
            ->whereNotNull('service_provider_config_id')
            ->select(['id', 'service_provider_config_id'])
            ->get();

        if ($modelConfigs->isEmpty()) {
            return 0;
        }

        // 2. 提取所有唯一的 config_id
        $configIds = $modelConfigs->pluck('service_provider_config_id')->unique()->filter()->toArray();

        if (empty($configIds)) {
            return 0;
        }

        // 3. 批量查询存在的 config_id
        $existingConfigIds = Db::table('service_provider_configs')
            ->whereIn('id', $configIds)
            ->whereNull('deleted_at')
            ->pluck('id')
            ->toArray();

        // 4. 找出不存在的 config_id
        $invalidConfigIds = array_diff($configIds, $existingConfigIds);

        if (empty($invalidConfigIds)) {
            return 0;
        }

        // 5. 批量删除引用不存在配置的模型
        return Db::table('service_provider_models')
            ->where('organization_code', $organizationCode)
            ->where('organization_code', '!=', $officialOrganizationCode) // 双重防护
            ->whereIn('service_provider_config_id', $invalidConfigIds)
            ->delete();
    }

    /**
     * 清理配置数据无效的模型（配置解密后为空或所有值都是空）.
     */
    private function cleanModelsWithInvalidConfigData(string $organizationCode, string $officialOrganizationCode): int
    {
        // 1. 查询该组织下的所有配置
        $configs = Db::table('service_provider_configs')
            ->where('organization_code', $organizationCode)
            ->where('organization_code', '!=', $officialOrganizationCode) // 防护
            ->whereNull('deleted_at')
            ->select(['id', 'config'])
            ->get();

        $invalidConfigIds = [];

        // 2. 循环检查每个配置的有效性
        foreach ($configs as $config) {
            try {
                // 解密配置（使用配置 ID 作为 salt）
                $decodedConfig = ProviderConfigAssembler::decodeConfig($config['config'], (string) $config['id']);

                // 检查配置是否有效
                if ($this->isConfigDataInvalid($decodedConfig)) {
                    $invalidConfigIds[] = $config['id'];
                }
            } catch (Throwable $e) {
                // 如果解密失败，也认为是无效配置
                $invalidConfigIds[] = $config['id'];
            }
        }

        if (empty($invalidConfigIds)) {
            return 0;
        }

        // 3. 批量删除使用无效配置的模型
        return Db::table('service_provider_models')
            ->where('organization_code', $organizationCode)
            ->where('organization_code', '!=', $officialOrganizationCode) // 双重防护
            ->whereIn('service_provider_config_id', $invalidConfigIds)
            ->delete();
    }

    /**
     * 检查解密后的配置数据是否无效.
     * @param mixed $decodedConfig
     */
    private function isConfigDataInvalid($decodedConfig): bool
    {
        // 不是数组
        if (! is_array($decodedConfig)) {
            return true;
        }

        // 数组为空
        if (empty($decodedConfig)) {
            return true;
        }

        // 检查数组中所有key的值是否都为空
        foreach ($decodedConfig as $key => $value) {
            // 如果有任何一个值不为空，则配置有效
            if (! empty($value)) {
                return false;
            }
        }

        // 所有值都是空，配置无效
        return true;
    }

    /**
     * 获取日志记录器.
     */
    private function getLogger(): LoggerInterface
    {
        $container = ApplicationContext::getContainer();
        return $container->get(LoggerFactory::class)?->get('migration');
    }
};
