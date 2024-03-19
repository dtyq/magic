<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\MicroAgent\AgentParser;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

readonly class YamlAgentParser implements AgentParserInterface
{
    /**
     * Load and parse agent file.
     */
    public function loadFromFile(string $filePath): array
    {
        if (! file_exists($filePath)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.file_not_found', ['file' => $filePath]);
        }

        $content = file_get_contents($filePath);
        if ($content === false) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.file_read_failed', ['file' => $filePath]);
        }

        // Parse content directly
        $parts = preg_split('/^---$/m', $content, 3);

        if (count($parts) < 2) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.invalid_format', ['format' => 'YAML Agent']);
        }

        $configSection = trim($parts[1]);
        $systemSection = isset($parts[2]) ? trim($parts[2]) : '';

        $config = $this->parseConfiguration($configSection);
        $systemContent = $this->parseSystemContent($systemSection);

        return [
            'config' => $config,
            'system' => $systemContent,
        ];
    }

    /**
     * Get supported file extensions.
     */
    public function getSupportedExtensions(): array
    {
        return ['agent.yaml', 'agent.yml'];
    }

    /**
     * Check if the parser supports the given file extension.
     */
    public function supports(string $extension): bool
    {
        return in_array($extension, $this->getSupportedExtensions(), true);
    }

    /**
     * Parse configuration section.
     */
    private function parseConfiguration(string $configSection): array
    {
        $config = [];

        if (empty($configSection)) {
            return $config;
        }

        $lines = explode("\n", $configSection);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || ! str_contains($line, ':')) {
                continue;
            }

            [$key, $value] = array_map('trim', explode(':', $line, 2));

            // Auto-detect and convert value types
            $config[$key] = $this->convertValueType($value);
        }

        return $config;
    }

    /**
     * Convert string value to appropriate type.
     */
    private function convertValueType(string $value): mixed
    {
        // Trim whitespace and remove surrounding quotes if present
        $trimmedValue = trim($value, " \t\n\r\0\x0B\"'");

        // Handle boolean values
        if (in_array(strtolower($trimmedValue), ['true', 'false'], true)) {
            return filter_var($trimmedValue, FILTER_VALIDATE_BOOLEAN);
        }

        // Handle numeric values (after removing quotes)
        if (is_numeric($trimmedValue)) {
            // Check if it contains a decimal point or is a float
            if (str_contains($trimmedValue, '.')) {
                return (float) $trimmedValue;
            }
            // Otherwise treat as integer
            return (int) $trimmedValue;
        }

        // Return as string (original value without quote removal for non-numeric strings)
        return $value;
    }

    /**
     * Parse system content section.
     */
    private function parseSystemContent(string $systemSection): string
    {
        if (empty($systemSection)) {
            return '';
        }

        $lines = explode("\n", $systemSection);
        $systemContent = '';
        $isSystemBlock = false;

        foreach ($lines as $line) {
            if (str_starts_with(trim($line), 'system:')) {
                $isSystemBlock = true;
                // Check if content starts on same line
                $content = trim(substr($line, strpos($line, ':') + 1));
                if ($content !== '|') {
                    $systemContent = $content;
                }
                continue;
            }

            if ($isSystemBlock) {
                // Handle multi-line content (remove leading spaces for indented blocks)
                $systemContent .= ($systemContent ? "\n" : '') . preg_replace('/^  /', '', $line);
            }
        }

        return trim($systemContent);
    }
}
