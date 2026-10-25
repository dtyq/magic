<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

class UpdateModelIdentifierMappingStatusRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义单组状态更新的结构校验规则。 */
    public function rules(): array
    {
        return [
            'group_id' => 'required|string|max:64',
            'status' => 'required|integer|in:0,1',
        ];
    }

    /** 返回面向用户的参数错误提示。 */
    public function messages(): array
    {
        return [
            'status.required' => __('service_provider.model_identifier_mapping.status_required'),
            'status.in' => __('service_provider.model_identifier_mapping.invalid_status'),
            'group_id.required' => __('service_provider.model_identifier_mapping.validation.group_id_required'),
            'group_id.max' => __('service_provider.model_identifier_mapping.validation.group_id_too_long'),
        ];
    }

    /** 返回已经校验的目标状态。 */
    public function getStatus(): int
    {
        return (int) $this->validated()['status'];
    }

    /** 将更新路由中的映射组标识纳入状态参数校验。 */
    protected function validationData(): array
    {
        return array_merge($this->all(), ['group_id' => (string) $this->route('groupId')]);
    }
}
