<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\Infrastructure\Core\AbstractValueObject;

abstract class AbstractServiceConfig extends AbstractValueObject implements ServiceConfigInterface
{
    /**
     * Extract required fields from a string in format ${field_name} or ${field_name|default_value}.
     *
     * @param string $text The text to parse
     * @return array<string> Array of field names (without default values)
     */
    protected function extractRequiredFields(string $text): array
    {
        if (empty($text)) {
            return [];
        }

        preg_match_all('/\$\{([^}]+)\}/', $text, $matches);
        $fields = [];

        foreach ($matches[1] ?? [] as $field) {
            // Extract field name (before pipe if default value exists)
            $fieldName = explode('|', $field, 2)[0];
            $fields[] = $fieldName;
        }

        return array_unique($fields);
    }

    /**
     * Extract required fields from multiple strings.
     *
     * @param array<string> $texts Array of texts to parse
     * @return array<string> Array of unique field names
     */
    protected function extractRequiredFieldsFromArray(array $texts): array
    {
        $allFields = [];
        foreach ($texts as $text) {
            if (is_string($text)) {
                $allFields = array_merge($allFields, $this->extractRequiredFields($text));
            }
        }
        return array_unique($allFields);
    }

    /**
     * Replace required fields in a string with actual values.
     * Supports format: ${field_name} and ${field_name|default_value}.
     *
     * @param string $text The text containing placeholders
     * @param array<string, string> $fieldValues Array of field names and their values
     * @return string Text with replaced values
     */
    protected function replaceFields(string $text, array $fieldValues): string
    {
        if (empty($text)) {
            return $text;
        }

        return preg_replace_callback('/\$\{([^}]+)\}/', function ($matches) use ($fieldValues) {
            $placeholder = $matches[1];

            // Check if placeholder contains default value (field_name|default_value)
            if (str_contains($placeholder, '|')) {
                [$fieldName, $defaultValue] = explode('|', $placeholder, 2);

                // Use provided value if exists, otherwise use default value
                return $fieldValues[$fieldName] ?? $defaultValue;
            }
            // No default value, use provided value if exists, otherwise use empty string
            $fieldName = $placeholder;
            return $fieldValues[$fieldName] ?? '';
        }, $text);
    }
}
