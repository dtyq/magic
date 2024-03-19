<?php

namespace Tiptap\Core;

use DOMDocument;
use DOMElement;
use Tiptap\Utils\InlineStyle;
use Tiptap\Utils\Minify;

class DOMParser
{
    protected $DOM;

    protected $schema;

    protected $storedMarks = [];

    public function __construct($schema)
    {
        $this->schema = $schema;
    }

    public function process(string $value): array
    {
        $this->setDocument($value);

        $content = $this->processChildren(
            $this->getDocumentBody()
        );

        return [
            'type' => $this->schema->topNode::$name,
            'content' => $content,
        ];
    }

    private function setDocument(string $value): DOMParser
    {
        libxml_use_internal_errors(true);

        $this->DOM = new DOMDocument;
        /**
         * @psalm-suppress ArgumentTypeCoercion
         */
        $this->DOM->loadHTML(
            $this->makeValidXMLDocument(
                $this->minify($value)
            )
        );

        return $this;
    }

    private function minify(string $value): string
    {
        return (new Minify)->process($value);
    }

    private function makeValidXMLDocument($value): string
    {
        return '<?xml encoding="utf-8" ?>' . $value;
    }

    private function getDocumentBody(): DOMElement
    {
        return $this->DOM->getElementsByTagName('body')->item(0);
    }

    private function processChildren($node): array
    {
        $nodes = [];

        foreach ($node->childNodes as $child) {
            if ($class = $this->getNodeFor($child)) {
                $item = $this->parseAttributes($class, $child);

                if ($item === null) {
                    if ($child->hasChildNodes()) {
                        $nodes = array_merge($nodes, $this->processChildren($child));
                    }

                    continue;
                }

                if ($child->hasChildNodes()) {
                    $item = array_merge($item, [
                        'content' => $this->processChildren($child),
                    ]);
                }

                if (count($this->storedMarks)) {
                    $item = array_merge($item, [
                        'marks' => $this->storedMarks,
                    ]);
                }

                if ($wrapper = $class::wrapper($child)) {
                    $item['content'] = [
                        array_merge($wrapper, [
                            'content' => $item['content'] ?? [],
                        ]),
                    ];
                }

                array_push($nodes, $item);
            } elseif ($class = $this->getMarkFor($child)) {
                array_push($this->storedMarks, $this->parseAttributes($class, $child));

                if ($child->hasChildNodes()) {
                    $nodes = array_merge($nodes, $this->processChildren($child));
                }

                array_pop($this->storedMarks);
            } elseif ($child->hasChildNodes()) {
                $nodes = array_merge($nodes, $this->processChildren($child));
            }
        }


        // If similar nodes with different text follow each other,
        // we can merge them into a single node.
        return $this->mergeSimilarNodes($nodes);
    }

    private function isMultidimensionalArray($array)
    {
        foreach ($array as $value) {
            if (is_array($value)) {
                return true;
            }
        }
        
        return false;
    }

    private function mergeSimilarNodes($nodes)
    {
        $result = [];

        /**
         * @psalm-suppress UnusedFunctionCall
         */
        array_reduce($nodes, function ($carry, $node) use (&$result) {
            // Ignore multidimensional arrays
            if ($this->isMultidimensionalArray($node) || $this->isMultidimensionalArray($carry)) {
                $result[] = $node;

                return $node;
            }

            // Check if text is the only difference
            $differentKeys = array_keys(array_diff($carry, $node));
            if ($differentKeys != ['text']) {
                $result[] = $node;

                return $node;
            }

            // Merge it!
            $result[count($result) - 1]['text'] .= $node['text'];

            return $result[count($result) - 1];
        }, []);

        return $result;
    }


    private function getNodeFor($item)
    {
        return $this->getExtensionFor($item, $this->schema->nodes);
    }

    private function getMarkFor($item)
    {
        return $this->getExtensionFor($item, $this->schema->marks);
    }

    private function getExtensionFor($node, $classes)
    {
        foreach ($classes as $class) {
            if ($this->checkParseRules($class->parseHTML($node), $node)) {
                return $class;
            }
        }

        return false;
    }

    private function checkParseRules($parseRules, $DOMNode): bool
    {
        if (is_array($parseRules)) {
            foreach ($parseRules as $parseRule) {
                if (! $this->checkParseRule($parseRule, $DOMNode)) {
                    continue;
                }

                return true;
            }
        }

        return false;
    }

    private function checkParseRule($parseRule, $DOMNode): bool
    {
        // ['tag' => 'span[type="mention"]']
        if (isset($parseRule['tag'])) {
            if (preg_match('/([a-zA-Z-]*)\[([a-z-]+)(="?([a-zA-Z]*)"?)?\]$/', $parseRule['tag'], $matches)) {
                $tag = $matches[1];
                $attribute = $matches[2];
                if (isset($matches[4])) {
                    $value = $matches[4];
                }
            } else {
                $tag = $parseRule['tag'];
            }

            if ($tag !== $DOMNode->nodeName) {
                return false;
            }

            if (isset($attribute) && ! $DOMNode->hasAttribute($attribute)) {
                return false;
            }

            if (isset($attribute) && isset($value) && $DOMNode->getAttribute($attribute) !== $value) {
                return false;
            }
        }

        // ['style' => 'font-weight=italic']
        if (isset($parseRule['style'])) {
            if (preg_match('/([a-zA-Z-]*)(="?([a-zA-Z-]*)"?)?$/', $parseRule['style'], $matches)) {
                $style = $matches[1];

                if (isset($matches[3])) {
                    $value = $matches[3];
                }
            } else {
                $style = $parseRule['style'];
            }

            if (! InlineStyle::hasAttribute($DOMNode, $style)) {
                return false;
            }

            if (isset($value) && InlineStyle::getAttribute($DOMNode, $style) !== $value) {
                return false;
            }
        }

        // ['getAttrs' => function($DOMNode) { … }]
        if (isset($parseRule['getAttrs'])) {
            if (isset($parseRule['style']) && InlineStyle::hasAttribute($DOMNode, $parseRule['style'])) {
                $parameter = InlineStyle::getAttribute($DOMNode, $parseRule['style']);
            } else {
                $parameter = $DOMNode;
            }

            if ($parseRule['getAttrs']($parameter) === false) {
                return false;
            }
        }

        if (
            ! is_array($parseRule)
            || ! count($parseRule)
            || (
                ! isset($parseRule['tag'])
                && ! isset($parseRule['style'])
                && ! isset($parseRule['getAttrs'])
            )) {
            return false;
        }

        return true;
    }

    /**
     * @return (array|mixed|string)[]|null
     *
     * @psalm-return array{type: mixed, text?: string, attrs?: array}|null
     */
    private function parseAttributes($class, $DOMNode): ?array
    {
        $item = [
            'type' => $class::$name,
        ];

        if ($class::$name === 'text') {
            $text = ltrim($DOMNode->nodeValue, "\n");

            if ($text === '') {
                return null;
            }

            $item = array_merge($item, [
                'text' => $text,
            ]);
        }

        $parseRules = $class->parseHTML();

        if (! is_array($parseRules)) {
            return $item;
        }

        foreach ($parseRules as $parseRule) {
            if (! $this->checkParseRule($parseRule, $DOMNode)) {
                continue;
            }

            $attributes = $parseRule['attrs'] ?? [];
            if (count($attributes)) {
                if (! isset($item['attrs'])) {
                    $item['attrs'] = [];
                }

                $item['attrs'] = array_merge($item['attrs'], $attributes);
            }

            if (isset($parseRule['getAttrs'])) {
                if (isset($parseRule['style']) && InlineStyle::hasAttribute($DOMNode, $parseRule['style'])) {
                    $parameter = InlineStyle::getAttribute($DOMNode, $parseRule['style']);
                } else {
                    $parameter = $DOMNode;
                }

                $attributes = $parseRule['getAttrs']($parameter);

                if (! is_array($attributes)) {
                    continue;
                }

                if (! isset($item['attrs'])) {
                    $item['attrs'] = [];
                }

                $item['attrs'] = array_merge($item['attrs'], $attributes);
            }
        }

        /**
         * public function addAttributes()
         * {
         *     return [
         *         'href' => [
         *             'parseHTML' => function ($DOMNode) {
         *                 $attrs['href'] = $DOMNode->getAttribute('href');
         *             }
         *         ],
         *     ];
         * }
         */
        foreach ($this->schema->getAttributeConfigurations($class) as $attribute => $configuration) {
            if (isset($configuration['parseHTML'])) {
                $value = $configuration['parseHTML']($DOMNode);
            } else {
                $value = $DOMNode->getAttribute($attribute) ?: null;
            }

            if ($value !== null) {
                $item['attrs'][$attribute] = $value;
            }
        }

        return $item;
    }
}
