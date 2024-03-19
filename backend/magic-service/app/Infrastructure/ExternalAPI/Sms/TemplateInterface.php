<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms;

use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;

interface TemplateInterface
{
    /**
     * 根据传入的短信类型和语种,尝试确定可能存在的模板id.
     */
    public function getTemplateIdByTypeAndLanguage(string $type, ?string $language): ?string;

    /**
     * 根据传入的短信类型和语种,确定短信内容. 可能会动态调整type对应的模板内容.
     */
    public function getContentBySMSTypeAndLanguage(string $type, ?string $language): string;

    /**
     * 根据前传入的短信模板id,确定短信内容.
     */
    public function getContentByTemplateId(string $templateId): string;

    /**
     * 解析模板变量,得到 变量key与变量value 的数组.
     */
    public function getTemplateVariables(string $content, array $messages): array;

    /**
     * 根据短信类型,返回类型支持的语种列表.
     * @return string[]
     */
    public function getTemplateLanguagesByType(string $type): array;

    /**
     * 根据语种要求和短信支持的签名列表,返回对应的签名文本.
     */
    public function formatSign(string $sign, ?LanguageEnum $language, ?LanguageEnum $defaultLanguage = LanguageEnum::ZH_CN): string;
}
