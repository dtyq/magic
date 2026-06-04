<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Request;

use Hyperf\Validation\Request\FormRequest;

class WeatherForecastRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'location' => 'required|string|max:255',
            'days' => 'integer|min:1|max:7',
            'language' => 'string|in:zh,en',
            'provider' => 'nullable|string|max:50',
        ];
    }

    public function attributes(): array
    {
        return [
            'location' => '位置',
            'days' => '预报天数',
            'language' => '语言',
            'provider' => '驱动',
        ];
    }
}
