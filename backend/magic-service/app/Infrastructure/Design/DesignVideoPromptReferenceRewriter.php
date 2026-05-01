<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Design;

use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;

readonly class DesignVideoPromptReferenceRewriter
{
    private const string INPUT_KEY_REFERENCE_IMAGES = 'reference_images';

    private const string INPUT_KEY_REFERENCE_VIDEOS = 'reference_videos';

    private const string INPUT_KEY_REFERENCE_AUDIOS = 'reference_audios';

    private const string FIELD_URI = 'uri';

    /**
     * design 入口仍兼容按原始文件名引用素材，但不再额外拼接“素材索引 / 任务描述”前缀。
     *
     * @param array<string, mixed> $rawInputs
     */
    public function rewrite(string $prompt, string $inputMode, array $rawInputs): string
    {
        if (! in_array(trim($inputMode), [
            VideoInputMode::OmniReference->value,
            VideoInputMode::ImageReference->value,
        ], true)) {
            return $prompt;
        }

        $referenceMappings = array_merge(
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_IMAGES] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_IMAGES] : [],
                '图片',
            ),
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_VIDEOS] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_VIDEOS] : [],
                '视频',
            ),
            $this->buildReferenceMentionMappings(
                is_array($rawInputs[self::INPUT_KEY_REFERENCE_AUDIOS] ?? null) ? $rawInputs[self::INPUT_KEY_REFERENCE_AUDIOS] : [],
                '音频',
            ),
        );
        if ($referenceMappings === [] || $prompt === '' || ! str_contains($prompt, '@')) {
            return $prompt;
        }

        $replacements = [];
        foreach ($referenceMappings as $mapping) {
            $replacements[$mapping['mention']] = $mapping['placeholder'];
        }

        uksort($replacements, static fn (string $left, string $right): int => strlen($right) <=> strlen($left));

        return str_replace(array_keys($replacements), array_values($replacements), $prompt);
    }

    /**
     * @param list<mixed> $references
     * @return list<array{mention: string, placeholder: string}>
     */
    private function buildReferenceMentionMappings(array $references, string $label): array
    {
        $mappings = [];
        $seenMentions = [];
        $index = 0;
        foreach ($references as $reference) {
            if (! is_array($reference)) {
                continue;
            }

            $fileName = $this->extractReferenceFileName((string) ($reference[self::FIELD_URI] ?? ''));
            if ($fileName === '') {
                continue;
            }

            $mention = '@' . $fileName;
            if (isset($seenMentions[$mention])) {
                continue;
            }

            ++$index;
            $seenMentions[$mention] = true;
            $mappings[] = [
                'mention' => $mention,
                'placeholder' => '@' . $label . $index,
            ];
        }

        return $mappings;
    }

    private function extractReferenceFileName(string $uri): string
    {
        $candidate = $uri;
        if (preg_match('#^https?://#i', $uri) === 1) {
            $path = parse_url($uri, PHP_URL_PATH);
            $candidate = is_string($path) && $path !== '' ? $path : $uri;
        }

        return trim(basename(rawurldecode($candidate)));
    }
}
