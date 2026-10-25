<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Assembler;

use App\Application\Mode\DTO\DefaultModelPricePreviewDTO;
use App\Application\Mode\Service\TextModelPriceSummaryResolver;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\Status;

/** 将已加载关系投影成售价白名单，不序列化实体、路由策略或成本配置。 */
class DefaultModelPricePreviewAssembler
{
    /** 共用文本价格解析，避免管理预览与前台算法分叉。 */
    public function __construct(private readonly TextModelPriceSummaryResolver $prices)
    {
    }

    /** 保留分组及关系顺序，动态父项只输出候选引用。 */
    public function assemble(ModeAggregate $mode, array $graph, string $locale, array $icons = []): DefaultModelPricePreviewDTO
    {
        $locale = str_replace('-', '_', $locale);
        $models = [];
        foreach ($graph['nodes'] as $id => $node) {
            $id = (string) $id;
            $model = $node['model'] ?? null;
            if ($model === null) {
                $models[$id] = ['kind' => 'unavailable', 'model_id' => $id, 'name' => $id, 'icon' => '', 'reason' => $node['reason']];
                continue;
            }
            $base = ['model_id' => $id, 'name' => $model->getLocalizedName($locale) ?: $id,
                'icon' => $icons[$model->getIcon()] ?? $model->getIcon()];
            if ($model->isDynamicModel()) {
                $models[$id] = $base + ['kind' => 'dynamic',
                    'state' => $node['invalid_config'] ? 'invalid_config' : ($model->getStatus() === Status::Enabled ? 'available' : 'disabled'),
                    'children' => $node['children']];
                continue;
            }
            $bindings = [];
            $available = false;
            $eligible = false;
            foreach ($node['bindings'] as $binding) {
                $provider = $graph['providers'][$binding->getServiceProviderConfigId()] ?? null;
                $summary = $this->prices->resolve($binding->getConfig());
                $reason = match (true) {
                    $binding->getStatus() !== Status::Enabled => 'model_disabled',
                    $provider?->getStatus() !== Status::Enabled => 'provider_disabled',
                    $binding->isDynamicModel() || $binding->getCategory() !== Category::LLM || ! $binding->getModelType()->isLLM() => 'unsupported_billing',
                    default => $summary['exclusion_reason'],
                };
                $available = $available || ($binding->getStatus() === Status::Enabled && $provider?->getStatus() === Status::Enabled && ! $binding->isDynamicModel());
                $eligible = $eligible || $reason === null;
                $summary['eligible'] = $reason === null;
                $summary['exclusion_reason'] = $reason;
                $bindings[] = ['binding_id' => (string) $binding->getId(),
                    'provider_name' => $provider?->getLocalizedAlias($locale) ?? ''] + $summary;
            }
            $models[$id] = $base + ['kind' => 'normal', 'state' => $eligible ? 'available' : ($available ? 'no_valid_price' : 'disabled'), 'bindings' => $bindings];
        }
        $groups = [];
        $groupAggregates = $mode->getGroupAggregates();
        foreach ($groupAggregates as $aggregate) {
            $group = $aggregate->getGroup();
            $items = [];
            $relations = $aggregate->getRelations();
            foreach ($relations as $relation) {
                $id = $relation->getModelId();
                if (($models[$id]['reason'] ?? null) === 'unsupported_type') {
                    continue;
                }
                $items[] = ['relation_id' => (string) $relation->getId(), 'model_id' => $id, 'display_name' => $models[$id]['name'] ?? $id];
            }
            $groups[] = ['id' => (string) $group->getId(), 'name' => $this->name($group->getNameI18n(), $locale),
                'icon' => $icons[$group->getIcon()] ?? $group->getIcon(), 'items' => $items];
        }
        // 非文本根项移除后，仅返回仍由分组或动态候选引用的节点。
        $reachable = [];
        $pending = [];
        foreach ($groups as $group) {
            foreach ($group['items'] as $item) {
                $pending[] = $item['model_id'];
            }
        }
        while ($pending !== []) {
            $id = array_pop($pending);
            if (isset($reachable[$id])) {
                continue;
            }
            $reachable[$id] = $models[$id];
            foreach ($models[$id]['children'] ?? [] as $child) {
                $pending[] = $child['model_id'];
            }
        }
        $entity = $mode->getMode();
        return new DefaultModelPricePreviewDTO(
            ['id' => (string) $entity->getId(), 'name' => $this->name($entity->getNameI18n(), $locale)],
            $groups,
            $reachable,
            $graph['warnings']
        );
    }

    /** 沿用管理端语言回退顺序，不按名称寻找默认模式。 */
    private function name(array $names, string $locale): string
    {
        return (string) ($names[$locale] ?? $names['zh_CN'] ?? $names['en_US'] ?? (reset($names) ?: ''));
    }
}
