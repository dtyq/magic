<?php

namespace Tiptap\Nodes;

use DomainException;
use Highlight\Highlighter;
use Tiptap\Utils\HTML;

class CodeBlockHighlight extends CodeBlock
{
    public function addOptions()
    {
        return [
            'languageClassPrefix' => 'hljs ',
            'HTMLAttributes' => [],
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $code = $node->content[0]->text ?? '';

        try {
            $highlighter = new Highlighter();

            if ($node->attrs->language ?? null) {
                $result = $highlighter->highlight($node->attrs->language, $code);
            } else {
                $result = $highlighter->highlightAuto($code);
            }

            $mergedAttributes = HTML::mergeAttributes(
                [
                    'class' => $this->options['languageClassPrefix'] . $result->language,
                ],
                $this->options['HTMLAttributes'],
                $HTMLAttributes,
            );

            $renderedAttributes = HTML::renderAttributes($mergedAttributes);

            $content = "<pre><code" . $renderedAttributes . ">";
            $content .= $result->value;
            $content .= "</code></pre>";
        } catch (DomainException $exception) {
            $mergedAttributes = HTML::mergeAttributes(
                $this->options['HTMLAttributes'],
                $HTMLAttributes,
            );

            $renderedAttributes = HTML::renderAttributes($mergedAttributes);

            $content = "<pre><code" . $renderedAttributes . ">";
            $content .= htmlentities($code);
            $content .= "</code></pre>";
        }

        return [
            'content' => $content,
        ];
    }
}
