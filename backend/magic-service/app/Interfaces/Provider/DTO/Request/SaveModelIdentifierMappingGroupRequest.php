<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use App\Application\Provider\DTO\SaveModelIdentifierMappingGroupDTO;
use Hyperf\Validation\Request\FormRequest;

class SaveModelIdentifierMappingGroupRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义映射组保存接口的结构校验规则。 */
    public function rules(): array
    {
        return [
            'group_name' => 'required|string|max:100',
            'group_id' => 'sometimes|string|max:64',
            'source_model_ids' => 'required|array|min:1|max:100',
            'source_model_ids.*' => 'required|string|max:100',
            'target_model_id' => 'required|string|max:100',
        ];
    }

    /** 返回面向用户的参数错误提示。 */
    public function messages(): array
    {
        return [
            'group_name.required' => __('service_provider.model_identifier_mapping.group_name_required'),
            'group_name.max' => __('service_provider.model_identifier_mapping.group_name_too_long'),
            'group_id.max' => __('service_provider.model_identifier_mapping.validation.group_id_too_long'),
            'source_model_ids.required' => __('service_provider.model_identifier_mapping.source_models_required'),
            'source_model_ids.min' => __('service_provider.model_identifier_mapping.source_models_required'),
            'source_model_ids.max' => __('service_provider.model_identifier_mapping.source_models_too_many'),
            'source_model_ids.*.required' => __('service_provider.model_identifier_mapping.validation.source_model_id_required'),
            'source_model_ids.*.max' => __('service_provider.model_identifier_mapping.validation.source_model_id_too_long'),
            'target_model_id.required' => __('service_provider.model_identifier_mapping.validation.target_model_required'),
            'target_model_id.max' => __('service_provider.model_identifier_mapping.validation.target_model_id_too_long'),
        ];
    }

    /** 将已通过接口校验的参数转换为应用层 DTO。 */
    public function toDTO(): SaveModelIdentifierMappingGroupDTO
    {
        return SaveModelIdentifierMappingGroupDTO::fromArray($this->validated());
    }

    /** 将更新路由中的映射组标识纳入保存参数校验。 */
    protected function validationData(): array
    {
        return array_merge($this->all(), ['group_id' => (string) $this->route('groupId')]);
    }
}
