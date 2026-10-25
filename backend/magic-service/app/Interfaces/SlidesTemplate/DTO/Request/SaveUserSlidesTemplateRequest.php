<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

class SaveUserSlidesTemplateRequest extends SaveSlidesTemplateRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['sort']);
        $rules['sort'] = 'missing';
        $rules['status'] = 'sometimes|integer|in:0,1';
        foreach (['owner_type', 'owner_id', 'organization_code', 'created_uid', 'updated_uid', 'source_type'] as $field) {
            $rules[$field] = 'missing';
        }
        return $rules;
    }
}
