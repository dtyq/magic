<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt;

readonly class KelingPromptReferenceFormatter
{
    /**
     * 将 canonical token {{image_1}} / {{video_1}} 转换为可灵 API 要求的 <<<image_1>>> 格式。
     */
    public function format(string $prompt): string
    {
        if ($prompt === '') {
            return $prompt;
        }

        return (string) preg_replace_callback(
            '/\{\{(image|video)_(\d+)}}/i',
            static fn (array $matches): string => sprintf('<<<%s_%s>>>', strtolower((string) $matches[1]), (string) $matches[2]),
            $prompt,
        );
    }
}
