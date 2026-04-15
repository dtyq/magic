<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity;

use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentConfig;
use App\Domain\KnowledgeBase\Entity\ValueObject\FragmentMode;
use App\Infrastructure\Core\AbstractEntity;

abstract class AbstractKnowledgeBaseEntity extends AbstractEntity
{
    protected function getDefaultFragmentConfig(): FragmentConfig
    {
        $fragmentConfig = [
            'mode' => FragmentMode::AUTO->value,
        ];
        return FragmentConfig::fromArray($fragmentConfig);
    }
}
