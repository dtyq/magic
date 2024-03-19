<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Volcengine;

use App\Infrastructure\ExternalAPI\Sms\AbstractSms;
use App\Infrastructure\ExternalAPI\Sms\SendResult;
use App\Infrastructure\ExternalAPI\Sms\SmsStruct;
use App\Infrastructure\ExternalAPI\Sms\TemplateInterface;
use App\Infrastructure\ExternalAPI\Sms\Volcengine\Api\VolcengineSms;

use function Hyperf\Support\make;

class VolceApiClient extends AbstractSms
{
    protected TemplateInterface $template;

    public function __construct(Template $template)
    {
        $this->template = $template;
    }

    public function send(SmsStruct $smsStruct): SendResult
    {
        if (! $smsStruct->getTemplateId()) {
            $templateId = $this->getTemplateId($smsStruct);
            $smsStruct->setTemplateId($templateId);
        }
        $variables = $this->parseVariables($smsStruct);
        // VolcengineSms 需要每次短信重新 new
        return make(VolcengineSms::class)->request($smsStruct->phone, $variables, $smsStruct->sign, $smsStruct->templateId);
    }

    public function getContent(SmsStruct $smsStruct): string
    {
        if (empty($smsStruct->variables)) {
            return $smsStruct->content ?: '';
        }
        $templateContent = $this->template->getContentByTemplateId($smsStruct->getTemplateId());
        // 按变量顺序,还原成完整的短信文本
        return $this->translateContent($templateContent, $smsStruct->variables);
    }

    /**
     * 解析传入的变量变量或者文本短信,得到模板短信变量的关联数组.
     */
    private function parseVariables(SmsStruct $smsStruct): array
    {
        $variables = $smsStruct->variables;
        $smsStruct->language = $this->getContentLanguage($smsStruct);
        // 火山短信只支持变量短信,根据完整的 $message 适配对应的 模板变量

        // $variables 可能为索引数组 ["商品A","供应商A",10],火山短信需要还原成关联数组
        if ($smsStruct->templateId && $this->array_is_list($variables)) {
            // 1.获取模板内容,确定变量的key
            $templateContent = $this->template->getContentByTemplateId($smsStruct->getTemplateId()) ?? '';
            // 2.根据变量key,还原关联数组
            $variables = $this->template->getTemplateVariables($templateContent, $variables);
        }
        return $variables;
    }

    private function array_is_list(array $array): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($array);
        }

        if ($array === [] || $array === array_values($array)) {
            return true;
        }
        $nextKey = -1;
        foreach ($array as $k => $v) {
            if ($k !== ++$nextKey) {
                return false;
            }
        }
        return true;
    }
}
