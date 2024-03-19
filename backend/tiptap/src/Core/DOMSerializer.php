<?php

namespace Tiptap\Core;

use DOMDocument;
use stdClass;
use Tiptap\Extensions\RenderTextInterface;
use Tiptap\Utils\HTML;

class DOMSerializer
{
    use SerializerTrait;

    protected $document;

    protected $schema;

    public function __construct($schema)
    {
        $this->schema = $schema;
    }

    private function renderNode($node, $previousNode = null, $nextNode = null, &$markStack = []): string
    {
        $html = [];
        $markTagsToClose = [];

        if (isset($node->marks)) {
            foreach ($node->marks as $mark) {
                foreach ($this->schema->marks as $class) {
                    $renderClass = $class;

                    if (! $this->isMarkOrNode($mark, $renderClass)) {
                        continue;
                    }

                    if (! $this->markShouldOpen($mark, $previousNode)) {
                        continue;
                    }

                    $html[] = $this->renderOpeningTag($renderClass, $mark);
                    # push recently created mark tag to the stack
                    $markStack[] = [$renderClass, $mark];
                }
            }
        }

        foreach ($this->schema->nodes as $extension) {
            if (! $this->isMarkOrNode($node, $extension)) {
                continue;
            }

            $html[] = $this->renderOpeningTag($extension, $node);

            break;
        }

        // ["content" => …]
        $lastKey = array_key_last($html);
        $lastElement = $html[$lastKey] ?? null;
        if (! is_null($lastKey) && isset($lastElement['content'])) {
            $html[$lastKey] = $lastElement['content'];
        }
        // child nodes
        elseif (isset($node->content)) {
            $nestedNodeMarkStack = [];
            foreach ($node->content as $index => $nestedNode) {
                $previousNestedNode = $node->content[$index - 1] ?? null;
                $nextNestedNode = $node->content[$index + 1] ?? null;

                $html[] = $this->renderNode($nestedNode, $previousNestedNode, $nextNestedNode, $nestedNodeMarkStack);
            }
        }
        // renderText($node)
        elseif (isset($extension) && $extension instanceof RenderTextInterface) {
            $html[] = $extension->renderText($node);
        }
        // text
        elseif (isset($node->text)) {
            $html[] = htmlspecialchars($node->text, ENT_QUOTES, 'UTF-8');
        }

        foreach ($this->schema->nodes as $extension) {
            if (! $this->isMarkOrNode($node, $extension)) {
                continue;
            }

            $html[] = $this->renderClosingTag($extension->renderHTML($node));
        }

        if (isset($node->marks)) {
            foreach (array_reverse($node->marks) as $mark) {
                foreach ($this->schema->marks as $extension) {
                    if (! $this->isMarkOrNode($mark, $extension)) {
                        continue;
                    }

                    if (! $this->markShouldClose($mark, $nextNode)) {
                        continue;
                    }

                    # remember which mark tags to close
                    $markTagsToClose[] = [$extension, $mark];
                }
            }
            # close mark tags and reopen when necessary
            $html = array_merge($html, $this->closeAndReopenTags($markTagsToClose, $markStack));
        }

        return implode($html);
    }

    private function closeAndReopenTags(array $markTagsToClose, array &$markStack): array
    {
        $markTagsToReopen = [];
        $closingTags = $this->closeMarkTags($markTagsToClose, $markStack, $markTagsToReopen);
        $reopeningTags = $this->reopenMarkTags($markTagsToReopen, $markStack);

        return array_merge($closingTags, $reopeningTags);
    }

    private function closeMarkTags($markTagsToClose, &$markStack, &$markTagsToReopen): array
    {
        $html = [];
        while(! empty($markTagsToClose)) {
            # close mark tag from the top of the stack
            $markTag = array_pop($markStack);
            $markExtension = $markTag[0];
            $mark = $markTag[1];
            $html[] = $this->renderClosingTag($markExtension->renderHTML($mark));

            # check if the last closed tag is overlapping and has to be reopened
            if(count(array_filter($markTagsToClose, function ($markToClose) use ($markExtension, $mark) {
                return $markExtension == $markToClose[0] && $mark == $markToClose[1];
            })) == 0) {
                $markTagsToReopen[] = $markTag;
            } else {
                # mark tag does not have to be reopened, but deleted from the 'to close' list
                $markTagsToClose = array_udiff($markTagsToClose, [$markTag], function ($a1, $a2) {
                    return strcmp($a1[1]->type, $a2[1]->type);
                });
            }
        }

        return $html;
    }

    private function reopenMarkTags($markTagsToReopen, &$markStack): array
    {
        $html = [];
        # reopen the overlapping mark tags and push them to the stack
        foreach(array_reverse($markTagsToReopen) as $markTagToOpen) {
            $renderClass = $markTagToOpen[0];
            $mark = $markTagToOpen[1];
            $html[] = $this->renderOpeningTag($renderClass, $mark);
            $markStack[] = [$renderClass, $mark];
        }

        return $html;
    }

    private function markShouldOpen($mark, $previousNode): bool
    {
        return $this->nodeHasMark($previousNode, $mark);
    }

    private function markShouldClose($mark, $nextNode): bool
    {
        return $this->nodeHasMark($nextNode, $mark);
    }

    private function nodeHasMark($node, $mark): bool
    {
        if (! $node) {
            return true;
        }

        if (! property_exists($node, 'marks')) {
            return true;
        }

        // The other node has same mark
        foreach ($node->marks as $otherMark) {
            if ($mark == $otherMark) {
                return false;
            }
        }

        return true;
    }

    private function renderOpeningTag($extension, $nodeOrMark, $renderHTML = false)
    {
        /**
         * public function addAttributes()
         * {
         *     return [
         *        'color' => [
         *            'renderHTML' => function ($attributes) {
         *                return [
         *                    'style' => "color: {$attributes['color']}",
         *                ];
         *            }
         *        ],
         *    ];
         * }
         */
        $HTMLAttributes = [];

        foreach ($this->schema->getAttributeConfigurations($extension) as $attribute => $configuration) {
            // 'rendered' => false
            if (isset($configuration['rendered']) && $configuration['rendered'] === false) {
                continue;
            }

            // 'default' => 'foobar'
            if (! isset($nodeOrMark->attrs->{$attribute}) && isset($configuration['default'])) {
                if (! isset($nodeOrMark->attrs)) {
                    $nodeOrMark->attrs = new stdClass;
                }

                $nodeOrMark->attrs->{$attribute} = $configuration['default'];
            }

            // 'renderHTML' => fn($attributes) …
            if (isset($configuration['renderHTML'])) {
                $value = $configuration['renderHTML']($nodeOrMark->attrs ?? new stdClass);
            } else {
                $value = [
                    $attribute => $nodeOrMark->attrs->{$attribute} ?? null,
                ];
            }

            if ($value !== null) {
                $HTMLAttributes = HTML::mergeAttributes($HTMLAttributes, $value);
            }
        }

        // Remove empty attributes
        $HTMLAttributes = array_filter($HTMLAttributes, fn ($HTMLAttribute) => $HTMLAttribute !== null);

        if ($renderHTML === false) {
            $renderHTML = $extension->renderHTML($nodeOrMark, $HTMLAttributes);
        }

        // ["content" => …]
        if (isset($renderHTML['content'])) {
            return $renderHTML;
        }

        // null
        if (is_null($renderHTML)) {
            return '';
        }

        // ['table', ['tbody', 0]]
        // ['table', ['class' => 'foobar'], ['tbody', 0]]
        if (is_array($renderHTML)) {
            $html = [];

            foreach ($renderHTML as $index => $renderInstruction) {
                // ['div', …]
                if (is_string($renderInstruction)) {
                    if (is_int($index) && $nextTag = $renderHTML[$index + 1] ?? null) {
                        // ['table', ['class' => 'custom-class']]
                        if (! in_array(0, $nextTag, true)) {
                            if (is_array($nextTag) && $this->isAnAttributeArray($nextTag)) {
                                $attributes = HTML::renderAttributes($nextTag);
                            } else {
                                $attributes = '';
                            }

                            // <a href="#">
                            $html[] = "<{$renderInstruction}{$attributes}>";
                        } else {
                            $html[] = "<{$renderInstruction}>";
                        }
                    } else {
                        $html[] = "<{$renderInstruction}>";
                    }

                    // ['div', 'span']
                    if (isset($nextTag) && is_array($nextTag) && ! in_array(0, $nextTag, true)) {
                        if (! $this->isAnAttributeArray($nextTag)) {
                            $html[] = $this->renderOpeningTag($extension, $nodeOrMark, $nextTag);
                            $html[] = $this->renderClosingTag($nextTag);
                        }
                    }

                    // ['div', ?, 'span']
                    if (is_int($index) && $nextTag = $renderHTML[$index + 2] ?? null) {
                        if (! in_array(0, $nextTag, true)) {
                            if (! $this->isAnAttributeArray($nextTag)) {
                                $html[] = $this->renderOpeningTag($extension, $nodeOrMark, $nextTag);
                                $html[] = $this->renderClosingTag($nextTag);
                            }
                        }
                    }

                    continue;
                }

                if (is_array($renderInstruction) && in_array(0, $renderInstruction, true)) {
                    $html[] = $this->renderOpeningTag($extension, $nodeOrMark, $renderInstruction);
                }
                // ['tbody', 0]
                // ['class' => 'foobar']
                elseif (is_array($renderInstruction)) {
                    continue;
                }
            }

            return implode($html);
        }

        throw new \Exception('[renderOpeningTag] Failed to use renderHTML: ' . json_encode($renderHTML));
    }

    private function isAnAttributeArray($items): bool
    {
        if (! is_array($items)) {
            return false;
        }

        $keys = array_keys($items);

        return $keys !== array_keys($keys);
    }

    private function isSelfClosing($tag): bool
    {
        $dom = new DOMDocument('1.0', 'utf-8');
        $element = $dom->createElement($tag, 'test');
        $dom->appendChild($element);
        $rendered = $dom->saveHTML();

        return substr_count($rendered, $tag) === 1;
    }

    /**
     * @return null|string
     */
    private function renderClosingTag($renderHTML)
    {
        // null
        if (is_null($renderHTML)) {
            return '';
        }

        // ["content" => …]
        if (isset($renderHTML['content'])) {
            return '';
        }

        // ['table', ['tbody']]
        if (is_array($renderHTML)) {
            $html = [];

            foreach (array_reverse($renderHTML) as $renderInstruction) {
                // 'div'
                if (is_string($renderInstruction)) {
                    if ($this->isSelfClosing($renderInstruction)) {
                        return null;
                    }

                    $html[] = "</{$renderInstruction}>";
                }
                // ['div', 0]
                elseif (is_array($renderInstruction) && in_array(0, $renderInstruction, true)) {
                    $html[] = $this->renderClosingTag($renderInstruction);
                }
            }

            return implode($html);
        }

        throw new \Exception('[renderClosingTag] Failed to use renderHTML: ' . json_encode($renderHTML));
    }

    public function process(array $value): string
    {
        $html = [];

        // transform document to object
        $this->document = json_decode(json_encode($value));

        $content = is_array($this->document->content) ? $this->document->content : [];

        $markStack = [];

        foreach ($content as $index => $node) {
            $previousNode = $content[$index - 1] ?? null;
            $nextNode = $content[$index + 1] ?? null;

            $html[] = $this->renderNode($node, $previousNode, $nextNode, $markStack);
        }

        return join($html);
    }
}
