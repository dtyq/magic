<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\CloudFile;

use Dtyq\CloudFile\Kernel\Struct\ImageProcessOptions;
use Hyperf\Context\RequestContext;

class ImageProcessFactory
{
    public static function getByHeader(): ?ImageProcessOptions
    {
        if (! RequestContext::has()) {
            return null;
        }
        $request = RequestContext::get();
        $process = $request->getHeaderLine('X-Magic-Image-Process');
        if (! $process) {
            return null;
        }
        return ImageProcessOptions::fromString($process);
    }
}
