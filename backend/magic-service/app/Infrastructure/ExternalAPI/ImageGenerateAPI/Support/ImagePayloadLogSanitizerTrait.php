<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support;

use App\Infrastructure\Util\Log\PayloadLogSanitizer;

trait ImagePayloadLogSanitizerTrait
{
    /**
     * Mask base64 images before writing request payloads to logs.
     */
    protected function sanitizePayloadForLog(array $payload): array
    {
        $sanitized = PayloadLogSanitizer::sanitizeValue($payload);

        return is_array($sanitized) ? $sanitized : $payload;
    }
}
