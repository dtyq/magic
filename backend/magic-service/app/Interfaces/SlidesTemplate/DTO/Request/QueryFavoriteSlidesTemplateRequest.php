<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SlidesTemplate\DTO\Request;

class QueryFavoriteSlidesTemplateRequest extends PublicQuerySlidesTemplateRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['scope']);
        return $rules;
    }
}
