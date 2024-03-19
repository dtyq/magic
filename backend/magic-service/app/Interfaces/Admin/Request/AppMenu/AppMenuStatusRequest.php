<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Request\AppMenu;

use App\Domain\AppMenu\Entity\ValueObject\AppMenuStatus;
use Hyperf\Validation\Request\FormRequest;
use Hyperf\Validation\Rule;

class AppMenuStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => 'required|string',
            'status' => ['required', 'integer', Rule::in(AppMenuStatus::getValues())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'id.required' => '应用ID不能为空',
            'id.string' => '应用ID必须是字符串',
            'status.required' => '状态不能为空',
            'status.integer' => '状态必须是整数',
            'status.in' => '状态不合法',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'id' => '应用ID',
            'status' => '状态',
        ];
    }
}
