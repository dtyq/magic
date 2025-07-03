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
     * Extract required fields from a string in format ${field_name}.
     *
     * @param string $text The text to parse
     * @return array<string> Array of field names
     */
    protected function extractRequiredFields(string $text): array
    {
        if (empty($text)) {
            return [];
        }

        preg_match_all('/\$\{([^}]+)\}/', $text, $matches);
        return array_unique($matches[1] ?? []);
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
     *
     * @param string $text The text containing placeholders
     * @param array<string, string> $fieldValues Array of field names and their values
     * @return string Text with replaced values
     */
    protected function replaceFields(string $text, array $fieldValues): string
    {
        if (empty($text) || empty($fieldValues)) {
            return $text;
        }

        $replacedText = $text;
        foreach ($fieldValues as $fieldName => $fieldValue) {
            $placeholder = '${' . $fieldName . '}';
            $replacedText = str_replace($placeholder, $fieldValue, $replacedText);
        }

        return $replacedText;
    }
}
