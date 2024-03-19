<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor;

use Dtyq\CodeExecutor\Contract\ExecutorInterface;
use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\Exception\ExecuteFailedException;
use Dtyq\CodeExecutor\Exception\InvalidArgumentException;

use function Dtyq\CodeExecutor\Utils\stripPHPTags;

abstract class AbstractExecutor implements ExecutorInterface
{
    /**
     * @throws InvalidArgumentException
     * @throws ExecuteFailedException
     */
    public function execute(ExecutionRequest $request): ExecutionResult
    {
        $language = $request->getLanguage();

        if (! $this->isLanguageSupported($language)) {
            throw new InvalidArgumentException("Language {$language->value} is not supported by this executor");
        }

        $request->setCode(stripPHPTags($request->getCode()));

        try {
            return $this->doExecute($request);
        } catch (ExecuteException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw new ExecuteFailedException("Failed to execute code: {$e->getMessage()}", previous: $e);
        }
    }

    abstract protected function doExecute(ExecutionRequest $request): ExecutionResult;

    /**
     * 检查语言是否被支持
     *
     * @param Language $language 检查的语言
     * @return bool 是否支持
     */
    protected function isLanguageSupported(Language $language): bool
    {
        return in_array($language, $this->getSupportedLanguages(), true);
    }
}
