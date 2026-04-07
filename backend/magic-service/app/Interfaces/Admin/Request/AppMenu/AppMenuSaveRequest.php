<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Request\AppMenu;

use App\Domain\AppMenu\Entity\ValueObject\AppMenuIconType;
use App\Domain\AppMenu\Entity\ValueObject\AppMenuStatus;
use App\Domain\AppMenu\Entity\ValueObject\DisplayScope;
use App\Domain\AppMenu\Entity\ValueObject\OpenMethod;
use Hyperf\Validation\Request\FormRequest;
use Hyperf\Validation\Rule;

class AppMenuSaveRequest extends FormRequest
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
            'id' => 'sometimes|string',
            'name_i18n' => 'required|array',
            'icon' => [
                'nullable',
                'string',
                'max:255',
                Rule::requiredIf(fn (): bool => $this->getRequestedIconType() === AppMenuIconType::Icon),
            ],
            'icon_url' => [
                'nullable',
                'string',
                'max:2048',
                Rule::requiredIf(fn (): bool => $this->getRequestedIconType() === AppMenuIconType::Image),
            ],
            'icon_type' => [
                'required',
                'integer',
                Rule::in(AppMenuIconType::getValues()),
            ],
            'path' => 'required|string|max:255',
            'open_method' => ['required', 'integer', Rule::in(OpenMethod::getValues())],
            'sort_order' => 'sometimes|integer|min:0',
            'display_scope' => ['required', 'integer', Rule::in(DisplayScope::getValues())],
            'status' => ['sometimes', 'integer', Rule::in(AppMenuStatus::getValues())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'id.string' => '应用ID必须是字符串',
            'name_i18n.required' => '应用名称（多语言）不能为空',
            'name_i18n.array' => '应用名称（多语言）必须是对象',
            'icon.required' => '图标不能为空',
            'icon.string' => '图标必须是字符串',
            'icon.max' => '图标最大长度为255个字符',
            'icon_url.required' => '图标图片不能为空',
            'icon_url.string' => '图标图片必须是字符串',
            'icon_url.max' => '图标图片最大长度为2048个字符',
            'icon_type.required' => '图标类型不能为空',
            'icon_type.integer' => '图标类型必须是整数',
            'icon_type.in' => '图标类型不合法',
            'path.required' => '应用路径不能为空',
            'path.string' => '应用路径必须是字符串',
            'path.max' => '应用路径最大长度为255个字符',
            'open_method.required' => '打开方式不能为空',
            'open_method.integer' => '打开方式必须是整数',
            'open_method.in' => '打开方式不合法',
            'sort_order.integer' => '排序必须是整数',
            'sort_order.min' => '排序不能小于0',
            'display_scope.required' => '可见范围不能为空',
            'display_scope.integer' => '可见范围必须是整数',
            'display_scope.in' => '可见范围不合法',
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
            'name_i18n' => '应用名称（多语言）',
            'icon' => '图标',
            'icon_url' => '图标图片',
            'icon_type' => '图标类型',
            'path' => '应用路径',
            'open_method' => '打开方式',
            'sort_order' => '排序',
            'display_scope' => '可见范围',
            'status' => '状态',
        ];
    }

    private function getRequestedIconType(): ?AppMenuIconType
    {
        $iconType = $this->input('icon_type');
        if ($iconType === null || $iconType === '') {
            return null;
        }

        return AppMenuIconType::tryFrom((int) $iconType);
    }
}
