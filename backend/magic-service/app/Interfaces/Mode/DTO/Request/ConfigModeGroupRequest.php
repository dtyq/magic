<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mode\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

use function Hyperf\Translation\__;

class ConfigModeGroupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'groups' => 'required|array|min:1',
            'groups.*.name' => 'required|string|max:100',
            'groups.*.icon' => 'nullable|string|max:255',
            'groups.*.color' => 'nullable|string|max:10|regex:/^#[0-9a-fA-F]{6}$/',
            'groups.*.description' => 'nullable|string|max:1000',
            'groups.*.sort' => 'nullable|integer|min:0',
            'groups.*.status' => 'nullable|integer|in:0,1',
            'groups.*.models' => 'nullable|array',
            'groups.*.models.*.model_id' => 'required|integer|min:1',
            'groups.*.models.*.sort' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'groups.required' => __('mode.groups_required'),
            'groups.array' => __('mode.groups_array'),
            'groups.min' => __('mode.groups_min'),
            'groups.*.name.required' => __('mode.group_name_required'),
            'groups.*.name.max' => __('mode.group_name_max'),
            'groups.*.icon.max' => __('mode.icon_max'),
            'groups.*.color.max' => __('mode.color_max'),
            'groups.*.color.regex' => __('mode.color_regex'),
            'groups.*.description.max' => __('mode.description_max'),
            'groups.*.sort.integer' => __('mode.sort_integer'),
            'groups.*.sort.min' => __('mode.sort_min'),
            'groups.*.status.integer' => __('mode.status_integer'),
            'groups.*.status.in' => __('mode.status_in'),
            'groups.*.models.array' => __('mode.models_array'),
            'groups.*.models.*.model_id.required' => __('mode.model_id_required'),
            'groups.*.models.*.model_id.integer' => __('mode.model_id_integer'),
            'groups.*.models.*.model_id.min' => __('mode.model_id_min'),
            'groups.*.models.*.sort.integer' => __('mode.model_sort_integer'),
            'groups.*.models.*.sort.min' => __('mode.model_sort_min'),
        ];
    }

    public function getGroups(): array
    {
        return $this->input('groups', []);
    }

    /**
     * 获取格式化的分组配置.
     */
    public function getFormattedGroups(): array
    {
        $groups = $this->getGroups();
        $formatted = [];

        foreach ($groups as $index => $group) {
            $formatted[] = [
                'name' => $group['name'],
                'icon' => $group['icon'] ?? '',
                'color' => $group['color'] ?? '',
                'description' => $group['description'] ?? '',
                'sort' => $group['sort'] ?? $index,
                'status' => $group['status'] ?? 1,
                'models' => $this->formatModels($group['models'] ?? []),
            ];
        }

        return $formatted;
    }

    /**
     * 获取所有模型ID.
     */
    public function getAllModelIds(): array
    {
        $modelIds = [];
        $groups = $this->getGroups();

        foreach ($groups as $group) {
            if (isset($group['models']) && is_array($group['models'])) {
                foreach ($group['models'] as $model) {
                    $modelIds[] = (int) $model['model_id'];
                }
            }
        }

        return array_unique($modelIds);
    }

    /**
     * 格式化模型配置.
     */
    private function formatModels(array $models): array
    {
        $formatted = [];

        foreach ($models as $index => $model) {
            $formatted[] = [
                'model_id' => (int) $model['model_id'],
                'sort' => $model['sort'] ?? $index,
            ];
        }

        // 按sort排序
        usort($formatted, fn ($a, $b) => $a['sort'] <=> $b['sort']);

        return $formatted;
    }
}
