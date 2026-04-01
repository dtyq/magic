<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Symfony\Component\Yaml\Yaml;

/**
 * Parses and rebuilds Markdown files with YAML frontmatter (--- fenced blocks).
 *
 * Frontmatter format:
 *   ---
 *   key: value
 *   list:
 *     - item1
 *     - item2
 *   ---
 *   optional markdown body
 */
class FrontmatterParser
{
    private const FENCE = '---';

    /**
     * Split a Markdown file into its YAML frontmatter (as an associative array)
     * and the remaining body text.
     *
     * @return array{data: array<string, mixed>, body: string}
     */
    public static function parse(string $content): array
    {
        $fence = self::FENCE;
        $content = ltrim($content);

        if (! str_starts_with($content, $fence)) {
            return ['data' => [], 'body' => $content];
        }

        $afterOpen = substr($content, strlen($fence));
        if ($afterOpen === '' || $afterOpen[0] !== "\n") {
            return ['data' => [], 'body' => $content];
        }

        $afterOpen = substr($afterOpen, 1);

        $closingPos = strpos($afterOpen, "\n" . $fence);
        if ($closingPos === false) {
            return ['data' => [], 'body' => $content];
        }

        $yamlBlock = substr($afterOpen, 0, $closingPos);
        $body = substr($afterOpen, $closingPos + strlen("\n" . $fence));

        if ($body !== '' && $body[0] === "\n") {
            $body = substr($body, 1);
        }

        $data = Yaml::parse($yamlBlock);
        if (! is_array($data)) {
            $data = [];
        }

        return ['data' => $data, 'body' => $body];
    }

    /**
     * Rebuild a Markdown file from structured frontmatter data and a body string.
     *
     * @param array<string, mixed> $data
     */
    public static function dump(array $data, string $body = ''): string
    {
        $fence = self::FENCE;
        $yamlBlock = Yaml::dump($data, 2, 2);
        $yamlBlock = rtrim($yamlBlock);

        $result = $fence . "\n" . $yamlBlock . "\n" . $fence . "\n";

        if ($body !== '') {
            $result .= $body;
        }

        return $result;
    }
}
