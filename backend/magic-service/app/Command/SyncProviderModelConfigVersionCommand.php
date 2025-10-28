<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Command;

use App\Domain\Provider\Entity\ProviderModelConfigVersionEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Repository\Facade\ProviderModelConfigVersionRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelConfigVersionModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\Contract\StdoutLoggerInterface;
use Psr\Container\ContainerInterface;
use Symfony\Component\Console\Input\InputOption;
use Throwable;

#[Command]
class SyncProviderModelConfigVersionCommand extends HyperfCommand
{
    public function __construct(
        protected ContainerInterface $container,
        protected StdoutLoggerInterface $logger,
        protected ProviderModelConfigVersionRepositoryInterface $configVersionRepository,
    ) {
        parent::__construct('sync:provider-model-config-version');
    }

    public function configure()
    {
        parent::configure();
        $this->setDescription('同步历史服务商模型配置数据到版本表');

        $this->addOption('dry-run', 'd', InputOption::VALUE_NONE, '试运行模式，不实际写入数据库');
        $this->addOption('force', 'f', InputOption::VALUE_NONE, '强制同步，即使已存在版本也会创建新版本');
        $this->addOption('limit', 'l', InputOption::VALUE_OPTIONAL, '限制处理的数量，用于测试', 0);
    }

    public function handle()
    {
        $isDryRun = $this->input->getOption('dry-run');
        $isForce = $this->input->getOption('force');
        $limit = (int) $this->input->getOption('limit');

        $this->logHeader($isDryRun, $isForce, $limit);

        try {
            $result = $this->syncConfigVersions($isDryRun, $isForce, $limit);
            $this->logSummary($result);

            return 0;
        } catch (Throwable $e) {
            $this->logger->error(sprintf('同步失败: %s', $e->getMessage()));
            $this->logger->error($e->getTraceAsString());
            return 1;
        }
    }

    /**
     * 同步配置版本数据.
     */
    protected function syncConfigVersions(bool $isDryRun, bool $isForce, int $limit): array
    {
        $stats = ['total' => 0, 'skipped' => 0, 'created' => 0, 'failed' => 0];

        $models = $this->fetchModels($limit);
        $stats['total'] = $models->count();

        $this->logger->info(sprintf('找到 %d 个服务商模型需要处理', $stats['total']));

        foreach ($models as $model) {
            try {
                $existingVersionCount = $this->getExistingVersionCount($model);

                if ($this->shouldSkip($existingVersionCount, $isForce)) {
                    $this->logSkipped($model, $existingVersionCount);
                    ++$stats['skipped'];
                    continue;
                }

                $nextVersion = $existingVersionCount + 1;

                if (! $isDryRun) {
                    $this->updateOldVersionsIfNeeded($model, $existingVersionCount, $isForce);
                    $this->createNewVersion($model, $nextVersion);
                }

                $this->logCreated($model, $nextVersion, $isDryRun);
                ++$stats['created'];
            } catch (Throwable $e) {
                $this->logFailed($model, $e);
                ++$stats['failed'];
            }
        }

        return $stats;
    }

    /**
     * 获取服务商模型列表.
     */
    private function fetchModels(int $limit)
    {
        $query = ProviderModelModel::query()
            ->whereNull('deleted_at')
            ->orderBy('id');

        if ($limit > 0) {
            $query->limit($limit);
        }

        return $query->get();
    }

    /**
     * 获取已存在的版本数量.
     */
    private function getExistingVersionCount(ProviderModelModel $model): int
    {
        return ProviderModelConfigVersionModel::query()
            ->where('service_provider_model_id', $model->id)
            ->count();
    }

    /**
     * 判断是否应该跳过.
     */
    private function shouldSkip(int $existingVersionCount, bool $isForce): bool
    {
        return $existingVersionCount > 0 && ! $isForce;
    }

    /**
     * 更新旧版本（如果需要）.
     */
    private function updateOldVersionsIfNeeded(ProviderModelModel $model, int $existingVersionCount, bool $isForce): void
    {
        if (! $isForce || $existingVersionCount === 0) {
            return;
        }

        ProviderModelConfigVersionModel::query()
            ->where('service_provider_model_id', $model->id)
            ->where('is_current_version', true)
            ->update(['is_current_version' => false]);
    }

    /**
     * 创建新版本.
     */
    private function createNewVersion(ProviderModelModel $model, int $nextVersion): void
    {
        $versionData = $this->buildVersionData($model, $nextVersion);
        $entity = new ProviderModelConfigVersionEntity($versionData);
        $dataIsolation = new ProviderDataIsolation('', '', '');

        $this->configVersionRepository->saveVersionWithTransaction($dataIsolation, $entity);
    }

    /**
     * 构建版本数据.
     */
    private function buildVersionData(ProviderModelModel $model, int $version): array
    {
        $config = is_string($model->config) ? json_decode($model->config, true) : $model->config;

        // 基础字段
        $baseData = [
            'service_provider_model_id' => $model->id,
            'version' => $version,
            'is_current_version' => true,
        ];

        // 配置字段映射
        $configFields = [
            'creativity', 'max_tokens', 'temperature', 'max_output_tokens',
            'billing_type', 'billing_currency', 'time_pricing',
            'input_pricing', 'output_pricing', 'cache_write_pricing', 'cache_hit_pricing',
            'input_cost', 'output_cost', 'cache_write_cost', 'cache_hit_cost',
            'support_function', 'support_embedding', 'support_deep_think', 'support_multi_modal',
            'official_recommended',
        ];

        $configData = [];
        foreach ($configFields as $field) {
            $configData[$field] = $config[$field] ?? $this->getDefaultValue($field);
        }

        // 特殊字段处理
        $configData['vector_size'] = $config['vector_size'] ?? 2048;

        return array_merge($baseData, $configData);
    }

    /**
     * 获取字段默认值.
     */
    private function getDefaultValue(string $field): mixed
    {
        $boolFields = ['support_function', 'support_embedding', 'support_deep_think', 'support_multi_modal', 'official_recommended'];

        if (in_array($field, $boolFields, true)) {
            return false;
        }

        if ($field === 'billing_type') {
            return 'tokens';
        }

        return null;
    }

    /**
     * 输出头部信息.
     */
    private function logHeader(bool $isDryRun, bool $isForce, int $limit): void
    {
        $this->logger->info('开始同步服务商模型配置版本数据...');
        $this->logger->info(sprintf('模式: %s', $isDryRun ? '试运行（不写入数据库）' : '正式执行'));

        if ($isForce) {
            $this->logger->warning('强制模式已启用：将为所有模型创建新版本');
        }

        if ($limit > 0) {
            $this->logger->info(sprintf('限制处理数量: %d', $limit));
        }
    }

    /**
     * 输出统计信息.
     */
    private function logSummary(array $result): void
    {
        $this->logger->info('=================================');
        $this->logger->info('同步完成！统计信息:');
        $this->logger->info(sprintf('  总模型数: %d', $result['total']));
        $this->logger->info(sprintf('  已有版本: %d', $result['skipped']));
        $this->logger->info(sprintf('  新增版本: %d', $result['created']));
        $this->logger->info(sprintf('  失败数量: %d', $result['failed']));
        $this->logger->info('=================================');
    }

    /**
     * 记录跳过日志.
     */
    private function logSkipped(ProviderModelModel $model, int $existingVersionCount): void
    {
        $this->logger->debug(sprintf(
            '[跳过] 模型 ID: %d, 名称: %s (已有 %d 个配置版本)',
            $model->id,
            $model->name ?: $model->model_id,
            $existingVersionCount
        ));
    }

    /**
     * 记录创建日志.
     */
    private function logCreated(ProviderModelModel $model, int $version, bool $isDryRun): void
    {
        $prefix = $isDryRun ? '[试运行]' : '[创建]';
        $this->logger->info(sprintf(
            '%s 模型 ID: %d, 名称: %s, 版本: %d',
            $prefix,
            $model->id,
            $model->name ?: $model->model_id,
            $version
        ));
    }

    /**
     * 记录失败日志.
     */
    private function logFailed(ProviderModelModel $model, Throwable $e): void
    {
        $this->logger->error(sprintf(
            '[失败] 模型 ID: %d, 错误: %s',
            $model->id,
            $e->getMessage()
        ));
    }
}
