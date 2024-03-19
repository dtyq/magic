<?php

namespace Tiptap\Utils;

use Exception;

class InlineStyle
{
    /**
     * @return string[]
     *
     * @psalm-return array<string, string>
     */
    public static function get($DOMNode): array
    {
        $results = [];

        if (! method_exists($DOMNode, 'getAttribute')) {
            return [];
        }

        $style = $DOMNode->getAttribute('style');

        preg_match_all(
            "/([\w-]+)\s*:\s*([^;]+)\s*;?/",
            $style,
            $matches,
            PREG_SET_ORDER
        );

        foreach ($matches as $match) {
            $results[$match[1]] = $match[2];
        }

        return $results;
    }

    public static function hasAttribute($DOMNode, $value): bool
    {
        $styles = self::get($DOMNode);

        if (is_string($value)) {
            return in_array($value, array_keys($styles));
        }

        if (is_array($value)) {
            return array_diff($value, $styles) == [];
        }

        throw new Exception('Can’t compare inline styles to ' . json_encode($value));
    }

    public static function getAttribute($DOMNode, $attribute): ?string
    {
        return self::get($DOMNode)[$attribute] ?? null;
    }
}
