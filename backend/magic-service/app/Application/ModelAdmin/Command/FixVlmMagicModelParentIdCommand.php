<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Command;

use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderCode;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderConfigRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderModelsRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderRepository;
use Exception;
use Hyperf\Command\Annotation\Command;
use Hyperf\Command\Command as HyperfCommand;
use Hyperf\DbConnection\Db;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Console\Input\InputOption;

/**
 * @Command
 */
#[Command]
class FixVlmMagicModelParentIdCommand extends HyperfCommand
{
    /**
     * 命令描述.
     */
    protected string $description = '修复文生图 Magic 服务商模型的父子关系，重新建立 modelParentId 关联';

    protected ServiceProviderRepository $serviceProviderRepository;

    protected ServiceProviderConfigRepository $serviceProviderConfigRepository;

    protected ServiceProviderModelsRepository $serviceProviderModelsRepository;

    protected LoggerInterface $logger;

    protected ContainerInterface $container;

    protected string $officeOrganization;

    /**
     * 构造函数，注入依赖.
     */
    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
        $this->serviceProviderRepository = $container->get(ServiceProviderRepository::class);
        $this->serviceProviderConfigRepository = $container->get(ServiceProviderConfigRepository::class);
        $this->serviceProviderModelsRepository = $container->get(ServiceProviderModelsRepository::class);
        $this->logger = $container->get(LoggerInterface::class);
        $this->officeOrganization = config('service_provider.office_organization');

        parent::__construct('fix:vlm-magic-model-parent-id');
    }

    /**
     * 配置命令选项.
     */
    public function configure()
    {
        $this->addOption('dry-run', null, InputOption::VALUE_NONE, '预检查模式，只检查不修复');
        $this->addOption('batch-size', null, InputOption::VALUE_OPTIONAL, '批量处理大小', 100);
    }

    /**
     * 命令处理方法.
     */
    public function handle()
    {
        $isDryRun = $this->input->getOption('dry-run');
        $batchSize = (int) $this->input->getOption('batch-size');

        $this->line('开始修复文生图 Magic 服务商模型的父子关系...', 'info');
        $this->line('预检查模式: ' . ($isDryRun ? '是' : '否'), 'info');
        $this->line('批量处理大小: ' . $batchSize, 'info');

        try {
            // 1. 查找需要修复的模型
            $brokenModels = $this->findBrokenModels();
            if (empty($brokenModels)) {
                $this->line('没有找到需要修复的模型', 'info');
                return;
            }

            $this->line('找到需要修复的模型数量: ' . count($brokenModels), 'info');

            // 2. 匹配父模型并修复
            $fixedCount = 0;
            $failedCount = 0;
            $chunks = array_chunk($brokenModels, $batchSize);

            foreach ($chunks as $chunk) {
                $result = $this->fixModelParentIds($chunk, $isDryRun);
                $fixedCount += $result['fixed'];
                $failedCount += $result['failed'];
            }

            // 3. 输出结果
            $this->line('修复完成!', 'info');
            $this->line('成功修复: ' . $fixedCount . ' 个模型', 'info');
            $this->line('修复失败: ' . $failedCount . ' 个模型', $failedCount > 0 ? 'error' : 'info');
        } catch (Exception $e) {
            $this->line('修复过程中发生错误: ' . $e->getMessage(), 'error');
            $this->logger->error('VLM Magic 模型父子关系修复失败', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 查找需要修复的模型.
     * @return array 需要修复的模型列表
     */
    protected function findBrokenModels(): array
    {
        $this->line('正在查找需要修复的模型...', 'info');

        // 1. 获取 Magic 服务商（文生图类别）
        $magicServiceProvider = $this->serviceProviderRepository->getOfficial(ServiceProviderCategory::VLM);
        if (! $magicServiceProvider) {
            $this->line('未找到 Magic 文生图服务商', 'error');
            return [];
        }

        // 2. 获取所有非官方组织的 Magic 服务商配置
        $allMagicConfigs = $this->serviceProviderConfigRepository->getsByServiceProviderId($magicServiceProvider->getId());
        $nonOfficeConfigs = [];
        foreach ($allMagicConfigs as $config) {
            if ($config->getOrganizationCode() !== $this->officeOrganization) {
                $nonOfficeConfigs[] = $config;
            }
        }

        if (empty($nonOfficeConfigs)) {
            $this->line('未找到非官方组织的 Magic 服务商配置', 'info');
            return [];
        }

        // 3. 查找这些配置下 modelParentId 为 0 的文生图模型
        $brokenModels = [];
        $nonOfficeConfigIds = array_map(function ($config) {
            return $config->getId();
        }, $nonOfficeConfigs);

        $allModels = $this->serviceProviderModelsRepository->getModelsByConfigIds($nonOfficeConfigIds);
        foreach ($allModels as $model) {
            // 检查是否是文生图模型且 modelParentId 为 0 或 null
            if ($model->getCategory() === ServiceProviderCategory::VLM->value
                && ($model->getModelParentId() === 0 || $model->getModelParentId() === null) && $model->getIsOffice() === 1) {
                $brokenModels[] = $model;
            }
        }

        $this->line('找到需要修复的模型数量: ' . count($brokenModels), 'info');
        return $brokenModels;
    }

    /**
     * 修复模型的父子关系.
     * @param array $models 需要修复的模型列表
     * @param bool $isDryRun 是否为预检查模式
     * @return array 修复结果统计
     */
    protected function fixModelParentIds(array $models, bool $isDryRun): array
    {
        $fixedCount = 0;
        $failedCount = 0;
        $updates = [];

        // 预加载所有可能的父模型，避免重复查询
        $parentModelsMap = $this->preloadParentModels($models);

        foreach ($models as $model) {
            try {
                // 从预加载的数据中查找父模型
                $parentModel = $this->findParentModelFromCache($model, $parentModelsMap);
                if (! $parentModel) {
                    $this->line('未找到模型 ' . $model->getModelId() . ' (version: ' . $model->getModelVersion() . ', 组织: ' . $model->getOrganizationCode() . ') 的父模型', 'warning');
                    ++$failedCount;
                    continue;
                }

                // 准备更新数据
                $updates[] = [
                    'id' => $model->getId(),
                    'model_parent_id' => $parentModel->getId(),
                    'model_id' => $model->getModelId(),
                    'model_version' => $model->getModelVersion(),
                    'parent_model_id' => $parentModel->getModelId(),
                    'organization_code' => $model->getOrganizationCode(),
                ];

                $this->line('准备修复模型: ID=' . $model->getModelId() . ' (数据库ID: ' . $model->getId() . ', 组织: ' . $model->getOrganizationCode() . ') -> 父模型: ID=' . $parentModel->getModelId() . ' (父模型数据库ID: ' . $parentModel->getId() . ')', 'info');
                ++$fixedCount;
            } catch (Exception $e) {
                $this->line('处理模型 ' . $model->getName() . ' 时发生错误: ' . $e->getMessage(), 'error');
                ++$failedCount;
            }
        }

        // 如果不是预检查模式，执行实际的更新
        if (! $isDryRun && ! empty($updates)) {
            $this->executeUpdates($updates);
        }

        return [
            'fixed' => $fixedCount,
            'failed' => $failedCount,
        ];
    }

    /**
     * 预加载所有可能的父模型数据.
     * @param array $models 需要修复的模型列表
     * @return array 父模型映射 [modelVersion => parentModel]
     */
    protected function preloadParentModels(array $models): array
    {
        $this->line('预加载父模型数据...', 'info');

        // 1. 获取所有官方文生图服务商（排除Magic）
        $officialVLMProviders = $this->serviceProviderRepository->getAllByCategory(1, 1000, ServiceProviderCategory::VLM);
        $officialVLMProviderIds = [];
        foreach ($officialVLMProviders as $provider) {
            if ($provider->getProviderCode() !== ServiceProviderCode::Magic->value) {
                $officialVLMProviderIds[] = $provider->getId();
            }
        }

        if (empty($officialVLMProviderIds)) {
            return [];
        }

        // 2. 获取官方组织的这些服务商配置
        $officialConfigs = $this->serviceProviderConfigRepository->getByServiceProviderIdsAndOrganizationCode(
            $officialVLMProviderIds,
            $this->officeOrganization
        );

        if (empty($officialConfigs)) {
            return [];
        }

        $officialConfigIds = array_map(function ($config) {
            return $config->getId();
        }, $officialConfigs);

        // 3. 一次性获取官方组织的所有文生图模型
        $allOfficialModels = $this->serviceProviderModelsRepository->getModelsByConfigIds($officialConfigIds);

        // 4. 构建父模型映射：modelVersion -> 最佳父模型
        $parentModelsMap = [];
        foreach ($allOfficialModels as $model) {
            if ($model->getCategory() === ServiceProviderCategory::VLM->value) {
                $version = $model->getModelVersion();

                // 如果还没有这个版本的模型，或者当前模型状态更好，则更新
                if (! isset($parentModelsMap[$version])
                    || ($model->getStatus() === Status::ACTIVE->value && $parentModelsMap[$version]->getStatus() !== Status::ACTIVE->value)) {
                    $parentModelsMap[$version] = $model;
                }
            }
        }

        $this->line('预加载完成，找到 ' . count($parentModelsMap) . ' 个不同版本的父模型', 'info');
        return $parentModelsMap;
    }

    /**
     * 从缓存中查找父模型.
     * @param object $childModel 子模型
     * @param array $parentModelsMap 父模型映射
     * @return null|object 父模型
     */
    protected function findParentModelFromCache($childModel, array $parentModelsMap): ?object
    {
        return $parentModelsMap[$childModel->getModelVersion()] ?? null;
    }

    /**
     * 执行批量更新.
     * @param array $updates 更新数据
     */
    protected function executeUpdates(array $updates): void
    {
        if (empty($updates)) {
            return;
        }

        Db::beginTransaction();
        try {
            // 批量更新，避免循环执行单个更新
            $this->batchUpdateModelParentIds($updates);

            Db::commit();
            $this->line('批量更新成功，共更新 ' . count($updates) . ' 个模型', 'info');

            // 显示更新详情（只显示前几个，避免输出太多）
            $displayCount = min(5, count($updates));
            for ($i = 0; $i < $displayCount; ++$i) {
                $update = $updates[$i];
                $this->line('已修复模型: ID=' . $update['model_id'] . ' (组织: ' . $update['organization_code'] . ') -> 父模型: ID=' . $update['parent_model_id'], 'info');
            }

            if (count($updates) > $displayCount) {
                $this->line('... 还有 ' . (count($updates) - $displayCount) . ' 个模型修复成功', 'info');
            }
        } catch (Exception $e) {
            Db::rollBack();
            $this->line('批量更新失败: ' . $e->getMessage(), 'error');
            throw $e;
        }
    }

    /**
     * 批量更新模型的 model_parent_id.
     * @param array $updates 更新数据
     */
    protected function batchUpdateModelParentIds(array $updates): void
    {
        if (empty($updates)) {
            return;
        }

        // 构建批量更新的 CASE WHEN 语句
        $whenClauses = [];
        $modelIds = [];

        foreach ($updates as $update) {
            $modelIds[] = $update['id'];
            $whenClauses[] = "WHEN {$update['id']} THEN {$update['model_parent_id']}";
        }

        $modelIdsStr = implode(',', $modelIds);
        $whenClausesStr = implode(' ', $whenClauses);

        // 执行批量更新
        $sql = "UPDATE service_provider_models SET model_parent_id = CASE id {$whenClausesStr} END WHERE id IN ({$modelIdsStr})";
        Db::statement($sql);
    }
}
