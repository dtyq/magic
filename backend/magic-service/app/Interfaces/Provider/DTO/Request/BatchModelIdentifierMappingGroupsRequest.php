<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use App\Application\Provider\DTO\BatchModelIdentifierMappingGroupsDTO;
use Hyperf\Validation\Request\FormRequest;

class BatchModelIdentifierMappingGroupsRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义映射组批量操作的结构校验规则。 */
    public function rules(): array
    {
        return [
            'group_ids' => 'required|array|min:1|max:100',
            'group_ids.*' => 'required|string|max:64',
            'status' => 'sometimes|integer|in:0,1',
        ];
    }

    /** 返回面向用户的参数错误提示。 */
    public function messages(): array
    {
        return [
            'group_ids.required' => __('service_provider.model_identifier_mapping.validation.group_ids_required'),
            'group_ids.min' => __('service_provider.model_identifier_mapping.validation.group_ids_required'),
            'group_ids.max' => __('service_provider.model_identifier_mapping.validation.group_ids_too_many'),
            'group_ids.*.required' => __('service_provider.model_identifier_mapping.validation.group_id_required'),
            'group_ids.*.max' => __('service_provider.model_identifier_mapping.validation.group_id_too_long'),
            'status.required' => __('service_provider.model_identifier_mapping.status_required'),
            'status.in' => __('service_provider.model_identifier_mapping.invalid_status'),
        ];
    }

    /** 将已通过接口校验的参数转换为应用层 DTO。 */
    public function toDTO(): BatchModelIdentifierMappingGroupsDTO
    {
        return BatchModelIdentifierMappingGroupsDTO::fromArray($this->validated());
    }
}
