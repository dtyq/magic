<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Request\Flow;

use Hyperf\Validation\Request\FormRequest;

class FlowImportRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'import_data' => 'required|array',
            'import_data.main_flow' => 'required|array',
            'import_data.main_flow.code' => 'required|string',
            'import_data.main_flow.name' => 'required|string',
            'import_data.main_flow.nodes' => 'required|array',
            'import_data.main_flow.edges' => 'required|array',
            'import_data.sub_flows' => 'array',
            'import_data.tool_flows' => 'array',
            'import_data.tool_sets' => 'array',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes(): array
    {
        return [
            'import_data' => '导入数据',
            'import_data.main_flow' => '主流程',
            'import_data.main_flow.code' => '主流程编码',
            'import_data.main_flow.name' => '主流程名称',
            'import_data.main_flow.nodes' => '主流程节点',
            'import_data.main_flow.edges' => '主流程边缘',
            'import_data.sub_flows' => '子流程',
            'import_data.tool_flows' => '工具流程',
            'import_data.tool_sets' => '工具集',
        ];
    }
}
