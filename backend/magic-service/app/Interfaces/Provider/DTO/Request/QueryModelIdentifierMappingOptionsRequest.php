<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use Hyperf\Validation\Request\FormRequest;

class QueryModelIdentifierMappingOptionsRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义模型候选项查询的结构校验规则。 */
    public function rules(): array
    {
        return ['keyword' => 'sometimes|nullable|string|max:100'];
    }

    /** 返回面向用户的参数错误提示。 */
    public function messages(): array
    {
        return [
            'keyword.max' => __('service_provider.model_identifier_mapping.validation.keyword_too_long'),
        ];
    }

    /** 返回已经校验并去除首尾空格的搜索词。 */
    public function getKeyword(): string
    {
        return trim((string) ($this->validated()['keyword'] ?? ''));
    }
}
