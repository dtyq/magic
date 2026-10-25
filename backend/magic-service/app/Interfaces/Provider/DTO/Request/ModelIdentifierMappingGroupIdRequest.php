<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

class ModelIdentifierMappingGroupIdRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义路由映射组标识的结构校验规则。 */
    public function rules(): array
    {
        return ['group_id' => 'required|string|max:64'];
    }

    /** 返回面向用户的路由参数错误提示。 */
    public function messages(): array
    {
        return [
            'group_id.required' => __('service_provider.model_identifier_mapping.validation.group_id_required'),
            'group_id.max' => __('service_provider.model_identifier_mapping.validation.group_id_too_long'),
        ];
    }

    /** 将路由参数纳入 FormRequest 校验数据。 */
    protected function validationData(): array
    {
        return ['group_id' => (string) $this->route('groupId')];
    }
}
