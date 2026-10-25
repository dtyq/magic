<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Design\Service;

use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * Reads bundled html-design-style source documents.
 *
 * DESIGN.md files are owned by Magic Service and stored under
 * ``storage/html-design-style/styles/<style_code>/DESIGN.md``. This service is
 * the only reader: it validates the style code, resolves the file inside the
 * fixed root, and returns the raw content with a sha256 digest so callers can
 * detect catalog / source drift.
 */
class HtmlDesignStyleSourceService
{
    private const STYLE_ROOT = BASE_PATH . '/storage/html-design-style/styles';

    private const SOURCE_FILE_NAME = 'DESIGN.md';

    public function __construct(private readonly string $styleRoot = self::STYLE_ROOT)
    {
    }

    /**
     * @return array{style_code: string, content: string, sha256: string}
     */
    public function getSource(string $styleCode): array
    {
        $normalizedCode = $this->validateStyleCode($styleCode);
        $sourcePath = $this->resolveSourcePath($normalizedCode);

        if (! is_file($sourcePath) || ! is_readable($sourcePath)) {
            ExceptionBuilder::throw(DesignErrorCode::StyleSourceNotFound, '', [
                'style_code' => $normalizedCode,
            ]);
        }

        $content = @file_get_contents($sourcePath);
        if ($content === false) {
            ExceptionBuilder::throw(DesignErrorCode::StyleSourceReadFailed);
        }

        return [
            'style_code' => $normalizedCode,
            'content' => $content,
            'sha256' => hash('sha256', $content),
        ];
    }

    private function validateStyleCode(string $styleCode): string
    {
        $normalized = trim($styleCode);

        if ($normalized === '' || ! preg_match('/^[a-z0-9][a-z0-9.-]*$/', $normalized)) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidStyleCode);
        }

        return $normalized;
    }

    private function resolveSourcePath(string $styleCode): string
    {
        $root = realpath($this->styleRoot);
        if ($root === false) {
            ExceptionBuilder::throw(DesignErrorCode::StyleSourceReadFailed);
        }

        $candidate = realpath($root . DIRECTORY_SEPARATOR . $styleCode . DIRECTORY_SEPARATOR . self::SOURCE_FILE_NAME);
        if ($candidate === false) {
            // realpath returns false when the file does not exist; keep the
            // lexical path for the caller-facing not-found branch.
            return $root . DIRECTORY_SEPARATOR . $styleCode . DIRECTORY_SEPARATOR . self::SOURCE_FILE_NAME;
        }

        // realpath check guards against symlink escapes and encoded separators.
        if (strpos($candidate, $root . DIRECTORY_SEPARATOR) !== 0) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidStyleCode);
        }

        return $candidate;
    }
}
