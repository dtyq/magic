<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\BuiltIn\ToolSet\AIImage\Tools;

use App\Application\Flow\ExecuteManager\BuiltIn\BuiltInToolSet;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Infrastructure\Core\Collector\BuiltInToolSet\Annotation\BuiltInToolDefine;
use Closure;

#[BuiltInToolDefine]
class AIImageForHighAesGeneralV21LBuiltInTool extends AbstractAIImageBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AIImage->getCode();
    }

    public function getName(): string
    {
        return 'ai_image_high_aes_general_v21_l';
    }

    public function getDescription(): string
    {
        return '文生图工具-火山-High-Aes-General-V21-L模型';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $this->executeCallback($executionData, 'high_aes_general_v21_L');
            return ['success' => true];
        };
    }
}
