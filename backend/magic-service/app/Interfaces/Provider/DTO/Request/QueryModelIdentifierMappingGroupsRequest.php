<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO\Request;

use App\Application\Provider\DTO\QueryModelIdentifierMappingGroupsDTO;
use Hyperf\Validation\Request\FormRequest;

class QueryModelIdentifierMappingGroupsRequest extends FormRequest
{
    /** 当前请求由权限注解和应用服务共同完成授权校验。 */
    public function authorize(): bool
    {
        return true;
    }

    /** 定义映射组分页查询的结构校验规则。 */
    public function rules(): array
    {
        return [
            'keyword' => 'sometimes|nullable|string|max:100',
            'status' => 'sometimes|nullable|integer|in:0,1',
            'page' => 'sometimes|integer|min:1',
            'page_size' => 'sometimes|integer|min:1|max:100',
        ];
    }

    /** 返回面向用户的参数错误提示。 */
    public function messages(): array
    {
        return [
            'keyword.max' => __('service_provider.model_identifier_mapping.validation.keyword_too_long'),
            'status.in' => __('service_provider.model_identifier_mapping.invalid_status'),
            'page.min' => __('service_provider.model_identifier_mapping.validation.page_invalid'),
            'page_size.max' => __('service_provider.model_identifier_mapping.validation.page_size_too_large'),
        ];
    }

    /** 将已通过接口校验的参数转换为应用层 DTO。 */
    public function toDTO(): QueryModelIdentifierMappingGroupsDTO
    {
        return QueryModelIdentifierMappingGroupsDTO::fromArray($this->validated());
    }
}
