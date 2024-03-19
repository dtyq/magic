<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Flow\Entity;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use Dtyq\ObjectGenerator\ObjectGeneratorFactory;

class MockMagicFlowAIModelEntity
{
    public static function createMockMagicFlowAIModelEntity(string $name): ?MagicFlowAIModelEntity
    {
        $file = BASE_PATH . '/test/Stub/MagicFlowAIModelEntity/' . $name . '.json';
        if (! file_exists($file)) {
            return null;
        }
        $json = file_get_contents($file);
        $entity = new MagicFlowAIModelEntity();
        ObjectGeneratorFactory::object()->shouldBindJson($entity, $json);
        return $entity;
    }
}
