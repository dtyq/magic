<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool\ImageGeneration\Contract;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\ImageGenerationEntity;
use App\Infrastructure\ExternalAPI\ImageGenerateAPI\Response\OpenAIFormatResponse;

/**
 * 设计侧图片异步任务：由 {@see DesignImageGenerationTaskHandlerFactory} 按 {@see ImageGenerationType} 解析具体实现类。
 */
interface DesignImageGenerationTaskHandlerInterface
{
    /**
     * 执行该类型对应的下游调用；缺参或无法处理时返回 null。
     */
    public function handle(
        DesignDataIsolation $dataIsolation,
        ImageGenerationEntity $entity,
        string $workspacePrefix,
    ): ?OpenAIFormatResponse;

    /**
     * 本任务类型若使用「参考图文件名 + 固定后缀 + 时间戳」规则，返回不含扩展名的 basename；否则返回 null，交由 {@see DesignGeneratedImageFileNameTool} 按 prompt/Agent 处理。
     */
    public function resolveRuleBasedOutputBaseName(ImageGenerationEntity $entity): ?string;
}
