<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;

/** 基于后台 App 快照构造价格展示关系，不查询分组、模型或服务商。 */
class DefaultModelPricePreviewGraphBuilder
{
    private const int MAX_DEPTH = 32;

    /** 保留规范绑定的候选关系，补齐不可用占位并报告配置异常。 */
    public function build(array $snapshot): array
    {
        $nodes = [];
        $warnings = [];
        $pending = $snapshot['model_ids'];
        while ($pending !== []) {
            $id = (string) array_shift($pending);
            if (array_key_exists($id, $nodes)) {
                continue;
            }
            if (isset($snapshot['not_loaded'][$id])) {
                $nodes[$id] = ['reason' => 'not_loaded'];
                $warnings[] = ['code' => $snapshot['not_loaded'][$id], 'model_id' => $id];
                continue;
            }
            $detail = $snapshot['details'][$id] ?? null;
            $bindings = $detail['all'] ?? [];
            if ($bindings === []) {
                $nodes[$id] = ['reason' => 'missing'];
                $warnings[] = ['code' => 'missing_model', 'model_id' => $id];
                continue;
            }
            // 复用后台详情的规范绑定，全部停用时保留首个绑定的配置供排查。
            $best = $detail['best'] ?? $bindings[0];
            if (! $this->isText($best)) {
                $nodes[$id] = ['reason' => 'unsupported_type'];
                continue;
            }
            $nodes[$id] = ['model' => $best, 'bindings' => $bindings, 'children' => [], 'invalid_config' => false];
            if (! $best->isDynamicModel()) {
                continue;
            }
            [$children, $invalid] = $this->children($best);
            $nodes[$id]['children'] = $children;
            $nodes[$id]['invalid_config'] = $invalid;
            if ($invalid) {
                $warnings[] = ['code' => 'invalid_config', 'model_id' => $id];
            }
            foreach ($bindings as $binding) {
                if (! $binding->isDynamicModel() || $binding->getAggregateConfig() !== $best->getAggregateConfig()) {
                    $warnings[] = ['code' => 'inconsistent_bindings', 'model_id' => $id];
                    break;
                }
            }
            foreach ($children as $child) {
                $pending[] = $child['model_id'];
            }
        }
        $this->detectCycles($nodes, $warnings);
        return ['nodes' => $nodes, 'providers' => $snapshot['providers'],
            'warnings' => array_values(array_unique($warnings, SORT_REGULAR))];
    }

    /** 模型类型和分类共同限制文本范围，防止图片或视频误用 Token 价格。 */
    private function isText(ProviderModelEntity $model): bool
    {
        return $model->getCategory() === Category::LLM && $model->getModelType()->isLLM();
    }

    /** 只读取候选标识，不读取策略权重或解析运行时命中模型。 */
    private function children(ProviderModelEntity $model): array
    {
        $raw = $model->getAggregateConfig()['models'] ?? null;
        if (! is_array($raw) || ! array_is_list($raw) || $raw === []) {
            return [[], true];
        }
        $children = [];
        $invalid = false;
        foreach ($raw as $index => $item) {
            $id = is_string($item) ? $item : (is_array($item) ? ($item['model_id'] ?? null) : null);
            if (! is_string($id) || trim($id) === '') {
                $invalid = true;
                continue;
            }
            $children[] = ['index' => $index, 'model_id' => $id];
        }
        return [$children, $invalid];
    }

    /** 用当前路径检测回边，共享子节点不会误报为环，遍历深度同时受保护。 */
    private function detectCycles(array $nodes, array &$warnings): void
    {
        $visited = [];
        $visit = function (string $id, array $path) use (&$visit, &$visited, &$warnings, $nodes): void {
            if (isset($path[$id])) {
                $warnings[] = ['code' => 'cycle', 'model_id' => $id];
                return;
            }
            if (count($path) >= self::MAX_DEPTH) {
                $warnings[] = ['code' => 'depth_limit', 'model_id' => $id];
                return;
            }
            if (isset($visited[$id])) {
                return;
            }
            $path[$id] = true;
            foreach ($nodes[$id]['children'] ?? [] as $child) {
                $visit($child['model_id'], $path);
            }
            $visited[$id] = true;
        };
        foreach (array_keys($nodes) as $id) {
            $visit((string) $id, []);
        }
    }
}
