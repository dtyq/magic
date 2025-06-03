<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;
use BackedEnum;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Di\Exception\InvalidDefinitionException;
use Hyperf\Logger\LoggerFactory;
use ReflectionEnum;
use ReflectionException;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

class ExceptionBuilder
{
    private BackedEnum $error;

    private int $code;

    private array $config = [
        'exception_class' => BusinessException::class,
        'error_code_mapper' => [],
    ];

    public function __construct(BackedEnum $error)
    {
        $this->error = $error;
        $this->code = (int) $error->value;
        $this->config = array_merge($this->config, ApplicationContext::getContainer()->get(ConfigInterface::class)?->get('error_message'));
    }

    public function getCode(): int
    {
        return $this->code;
    }

    /**
     * @param string $message 允许传入自定义的错误信息
     * @return never-return // 为了phpstan检测
     */
    public static function throw(BackedEnum $error, string $message = '', array $replace = [], ?string $locale = null, ?Throwable $throwable = null): void
    {
        if ($throwable) {
            // 记录原始异常信息
            $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(__CLASS__);
            $logger->error(sprintf(
                '记录原始的 throwable 异常 message:%s, code:%d, file:%s, line:%s, trace:%s',
                $throwable->getMessage(),
                $throwable->getCode(),
                $throwable->getFile(),
                $throwable->getLine(),
                $throwable->getTraceAsString()
            ));
        }
        $self = new self($error);
        $self->validateErrorCode();
        $exceptionClass = $self->initializeExceptionClass();
        /** @var BusinessException $exception */
        $exception = new $exceptionClass($message, $self->getCode(), $throwable);
        $self->setExceptionMessage($exception, $replace, $locale);
        throw $exception;
    }

    private function validateErrorCode(): void
    {
        $codeRange = $this->config['error_code_mapper'][$this->error::class] ?? [];
        if (empty($codeRange)) {
            throw new RuntimeException('Exception Mapper Not Found');
        }

        if ($this->code < $codeRange[0] || $this->code > $codeRange[1]) {
            throw new RuntimeException('Invalid Error Code, Out Of Range(' . $codeRange[0] . '-' . $codeRange[1] . ')');
        }
    }

    private function initializeExceptionClass(): string
    {
        $exceptionClass = $this->config['exception_class'];
        if (! class_exists($exceptionClass)) {
            throw new RuntimeException('Exception Class Not Found');
        }

        if (! is_a($exceptionClass, BusinessException::class, true)) {
            throw new RuntimeException('Exception Class Must Be Subclass Of ' . BusinessException::class);
        }

        return $exceptionClass;
    }

    private function setExceptionMessage(BusinessException $exception, array $replace = [], ?string $locale = null): void
    {
        $message = $exception->getMessage();
        if (empty($message)) {
            try {
                $ref = new ReflectionEnum($this->error);
                $attributes = $ref->getReflectionConstant($this->error->name)->getAttributes(ErrorMessage::class);
                if (! isset($attributes[0])) {
                    return;
                }

                /** @var ErrorMessage $errorObj */
                $errorObj = $attributes[0]->newInstance();
                $message = $errorObj->getMessage();
            } catch (InvalidDefinitionException|ReflectionException) {
                $message = '';
            }
        }
        $message = $this->getMessageTranslate($message, $replace, $locale);
        $exception->setMessage($message);
    }

    private function getMessageTranslate(string $message = '', array $replace = [], ?string $locale = null): string
    {
        // 处理占位符的国际化
        foreach ($replace as $key => $value) {
            if (is_string($value)) {
                $replace[$key] = trans($value, [], $locale);
            }
        }

        $messages = trans($message, $replace, $locale);
        if (is_array($messages)) {
            $messages = implode(' ', $messages);
        }
        return $messages;
    }
}
