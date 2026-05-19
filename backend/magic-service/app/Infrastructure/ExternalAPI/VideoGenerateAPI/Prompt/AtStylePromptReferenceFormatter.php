<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt;

readonly class AtStylePromptReferenceFormatter
{
    public function format(string $prompt): string
    {
        if ($prompt === '') {
            return $prompt;
        }

        return (string) preg_replace_callback(
            '/\{\{(image|video|audio)_(\d+)}}/i',
            static fn (array $matches): string => '@' . match (strtolower((string) $matches[1])) {
                'image' => '图片',
                'video' => '视频',
                'audio' => '音频',
                default => (string) $matches[1],
            } . (string) $matches[2],
            $prompt,
        );
    }
}
