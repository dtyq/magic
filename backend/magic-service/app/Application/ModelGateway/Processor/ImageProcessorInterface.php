<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Processor;

use App\Application\ModelGateway\Struct\ImageProcessContext;

/**
 * 图片处理管线中的单个处理步骤契约。
 * 每个实现只关心上下文中的一项职责，例如加水印或上传。
 */
interface ImageProcessorInterface
{
    public function process(ImageProcessContext $context): void;
}
