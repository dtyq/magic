<?php

namespace Tiptap\Nodes;

use DomainException;
use Exception;
use Highlight\Highlighter;
use Spatie\ShikiPhp\Shiki;
use Tiptap\Utils\HTML;

class CodeBlockShiki extends CodeBlock
{
    public function addOptions()
    {
        return [
            'languageClassPrefix' => 'language-',
            'HTMLAttributes' => [],
            'defaultLanguage' => 'html',
            'theme' => 'nord',
            'guessLanguage' => true,
        ];
    }

    public function renderHTML($node, $HTMLAttributes = [])
    {
        $code = $node->content[0]->text ?? '';

        // Language is set
        if ($node->attrs->language === null) {
            $language = $node->attrs->language;
        }
        // Auto-detect the language
        elseif ($this->options['guessLanguage']) {
            try {
                $highlighter = new Highlighter();
                $result = $highlighter->highlightAuto($code);
                $language = $result->language;
            } catch (Exception $exception) {
                //
            }
        }

        // Use the default language
        if (! isset($language)) {
            $language = $this->options['defaultLanguage'];
        }

        try {
            $content = Shiki::highlight($code, $language, 'nord');
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
