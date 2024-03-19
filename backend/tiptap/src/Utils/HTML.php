<?php

namespace Tiptap\Utils;

class HTML
{
    /**
     * Merge an associative array of attributes,
     * and make sure to merge classes and inline styles.
     */
    public static function mergeAttributes()
    {
        $args = func_get_args();

        $attributes = array_shift($args);

        foreach ($args as $moreAttributes) {
            foreach ($moreAttributes as $key => $value) {
                // class="foo bar"
                if ($key === 'class') {
                    $attributes['class'] = trim(($attributes['class'] ?? '') . ' ' . $value);

                    continue;
                }

                // style="color: red;"
                if ($key === 'style') {
                    $style = rtrim($attributes['style'] ?? '', '; ') . '; ' . rtrim($value, ';') . '; ';
                    $attributes['style'] = ltrim(trim($style), '; ');

                    continue;
                }

                $attributes[$key] = $value;
            }
        }

        return $attributes;
    }

    /**
     * Render an associative array of attributes
     * as a HTML string.
     */
    public static function renderAttributes(array $attrs): string
    {
        // Make boolean values a string, so they can be rendered in HTML
        $attrs = array_map(function ($attribute) {
            if ($attribute === true) {
                return 'true';
            }

            if ($attribute === false) {
                return 'false';
            }

            return $attribute;
        }, $attrs);

        $attributes = [];

        // class="custom"
        foreach (array_filter($attrs) as $name => $value) {
            $escapedValue = htmlentities($value);

            $attributes[] = " {$name}=\"{$escapedValue}\"";
        }

        return join($attributes);
    }
}
