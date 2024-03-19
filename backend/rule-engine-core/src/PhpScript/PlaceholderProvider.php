<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\RuleEngineCore\PhpScript;

use Dtyq\RuleEngineCore\PhpScript\Extension\PlaceholderExtension;
use Twig\Environment;
use Twig\Loader\ArrayLoader;

class PlaceholderProvider implements PlaceholderProviderInterface
{
    public function resolve($rules): array
    {
        $placeholders = [];
        $loader = new ArrayLoader();
        $environment = new Environment($loader);
        $e = new PlaceholderExtension();
        $environment->addExtension($e);
        foreach ($rules as $rule) {
            $loader->setTemplate('test', $rule);
            $source = $environment->getLoader()->getSourceContext('test');
            $environment->compileSource($source);
        }
        foreach ($e->getPlaceholders() as $placeholder) {
            if (in_array($placeholder, $placeholders)) {
                continue;
            }
            $placeholders[] = $placeholder;
        }

        return $placeholders;
    }

    public function replace($ruleName, $rules, $context): array
    {
        $res = [];
        $loader = new ArrayLoader();
        $twig = new Environment($loader);
        foreach ($rules as $key => $rule) {
            $loader->setTemplate($ruleName, $rule);
            $res[$key] = $twig->render($ruleName, $context);
        }

        return $res;
    }
}
