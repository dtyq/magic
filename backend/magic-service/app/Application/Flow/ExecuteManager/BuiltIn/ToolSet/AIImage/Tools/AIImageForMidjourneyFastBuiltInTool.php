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
class AIImageForMidjourneyFastBuiltInTool extends AbstractAIImageBuiltInTool
{
    public function getToolSetCode(): string
    {
        return BuiltInToolSet::AIImage->getCode();
    }

    public function getName(): string
    {
        return 'ai_image_for_midjourney_fast';
    }

    public function getDescription(): string
    {
        return '文生图工具-Midjourney-Fast模型';
    }

    public function getCallback(): ?Closure
    {
        return function (ExecutionData $executionData) {
            $this->executeCallback($executionData, 'fast');
            return ['success' => true];
        };
    }
}
