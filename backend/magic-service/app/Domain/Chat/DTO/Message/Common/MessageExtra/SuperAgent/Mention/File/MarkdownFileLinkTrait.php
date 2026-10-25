<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\File;

trait MarkdownFileLinkTrait
{
    private function formatMarkdownFileReference(FileData $data): string
    {
        return $this->formatMarkdownPathReference($data->getFilePath(), $data->getFileName());
    }

    private function formatMarkdownPathReference(?string $filePath, ?string $name, bool $isDirectory = false): string
    {
        $fileName = trim((string) $name);
        if ($filePath === null || $filePath === '') {
            return $fileName;
        }

        $isUserPath = str_starts_with($filePath, '~/');
        $normalizedPath = $isUserPath ? substr($filePath, 2) : str_replace('\\', '/', trim($filePath));
        if ($normalizedPath === '' || str_contains($normalizedPath, "\0") || preg_match('/[\x00-\x1F\x7F]/', $normalizedPath)) {
            return $fileName;
        }

        $segments = [];
        foreach (explode('/', $normalizedPath) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                return $fileName;
            }
            $segments[] = $segment;
        }
        if ($segments === []) {
            return $fileName;
        }

        $encodedPath = implode('/', array_map(
            static fn (string $segment): string => $isUserPath ? rawurlencode($segment) : strtr($segment, [
                '%' => '%25',
                '#' => '%23',
                '?' => '%3F',
                '<' => '%3C',
                '>' => '%3E',
            ]),
            $segments,
        ));
        $label = $fileName !== '' ? $fileName : (string) end($segments);
        $label = preg_replace('/\s+/u', ' ', $label) ?? $label;
        $label = trim($label);
        $label = str_replace(['\\', '[', ']'], ['\\\\', '\[', '\]'], $label);

        $destination = ($isUserPath ? '~/' : './') . $encodedPath . ($isDirectory ? '/' : '');
        return str_contains($destination, ' ')
            ? sprintf('[%s](<%s>)', $label, $destination)
            : sprintf('[%s](%s)', $label, $destination);
    }
}
