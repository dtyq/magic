<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms;

use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;

abstract class AbstractTemplate implements TemplateInterface
{
    /**
     * 短信type与模板id的映射关系.
     */
    protected array $typeToIdMap = [];

    /**
     * 根据短信type,进行变量短信的适配,还原整条短信文本内容.
     */
    protected array $typeContents = [];

    /**
     * 根据模板id,进行变量短信的适配,还原整条短信文本内容.
     */
    protected array $idContents = [];

    protected array $signMap = [];

    public function getTemplateIdByTypeAndLanguage(string $type, ?string $language): ?string
    {
        return $this->typeToIdMap[$language][$type] ?? null;
    }

    public function getContentBySMSTypeAndLanguage(string $type, ?string $language): string
    {
        $templateId = $this->getTemplateIdByTypeAndLanguage($type, $language);
        if ($templateId) {
            $content = $this->getContentByTemplateId($templateId);
        }
        if (empty($content)) {
            $content = $this->typeContents[$language][$type] ?? '';
        }
        return $content;
    }

    public function getContentByTemplateId(string $templateId): string
    {
        return $this->idContents[$templateId] ?? '';
    }

    public function getTemplateVariables(string $content, array $messages): array
    {
        $matches = [];
        // 匹配文本 ${code} 中的code
        $matched = preg_match_all('/\$\{([^}]+)}/uS', $content, $matches);
        // 匹配文本 {$code} 中的code
        ! $matched && $matched = preg_match_all('/\{\$([^}]+)}/uS', $content, $matches);
        if (! $matched) {
            return $messages;
        }
        $variables = [];
        // 模板$content中不存在 "${xxx}" 或者 {$xxx) 类型的字符.则按index顺序匹配
        foreach ($matches[1] as $index => $variableKey) {
            if (isset($messages[$variableKey])) {
                $variables[$variableKey] = $messages[$variableKey];
            } elseif (isset($messages[$index])) {
                $variables[$variableKey] = $messages[$index];
            }
        }
        return $variables;
    }

    /**
     * 根据短信类型,返回类型支持的语种列表.
     * @return string[]
     */
    public function getTemplateLanguagesByType(string $type): array
    {
        $languages = [];
        $languages[] = $this->getLanguages($type, $this->typeToIdMap);
        $languages[] = $this->getLanguages($type, $this->typeContents);
        return array_values(array_unique(array_merge(...$languages)));
    }

    public function formatSign(string $sign, ?LanguageEnum $language, ?LanguageEnum $defaultLanguage = LanguageEnum::ZH_CN): string
    {
        // 签名类型确定
        if (empty($sign)) {
            $sign = $this->getTemplateDefaultSignType($sign);
        }
        if (empty($this->signMap[$sign])) {
            // 签名类型不存在,直接返回
            return $sign;
        }

        // 确定签名的语种,需要从 用户指定语种,用户指定兜底语种,系统默认的兜底语种 中确定出来一个值
        $signLanguage = null;
        // 语种兜底的顺序
        $defaultLanguages = [$language, $defaultLanguage, LanguageEnum::EN_US, LanguageEnum::ZH_CN];
        foreach ($defaultLanguages as $value) {
            if (isset($this->signMap[$sign][$value])) {
                $signLanguage = $value;
                break;
            }
        }
        // 如果 $sign 在 $defaultLanguages 不存在值,则给一个type支持的语种
        $firstLanguage = null;
        if (isset($this->signMap[$sign]) && is_array($this->signMap[$sign])) {
            $firstLanguage = array_key_first($this->signMap[$sign]);
        }
        $signLanguage = $signLanguage ?? $firstLanguage;
        return $this->signMap[$sign][$signLanguage] ?? $sign;
    }

    /**
     * 当传入的签名类型不存在时,获取短信的默认签名类型.
     */
    abstract protected function getTemplateDefaultSignType(string $sign): string;

    /**
     * @return string[]
     */
    private function getLanguages(string $type, array $data): array
    {
        $languages = [];
        foreach ($data as $language => $smsTypeMap) {
            if (is_array($smsTypeMap) && array_key_exists($type, $smsTypeMap)) {
                is_string($language) && $languages[] = $language;
            }
        }
        return $languages;
    }
}
