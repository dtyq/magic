<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use RuntimeException;

final class VideoSubmitEndpointResolver
{
    public static function resolve(string $modelVersion): string
    {
        $normalized = trim($modelVersion);
        if ($normalized === '') {
            throw new RuntimeException('video model version missing');
        }

        if (str_starts_with($normalized, '/')) {
            return $normalized;
        }

        if (str_starts_with($normalized, 'api/')) {
            return '/' . $normalized;
        }

        if (! str_starts_with($normalized, 'video_')) {
            $normalized = 'video_' . $normalized;
        }

        return '/api/async/' . $normalized;
    }
}
