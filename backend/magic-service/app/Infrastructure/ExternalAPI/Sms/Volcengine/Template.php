<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms\Volcengine;

use App\Infrastructure\ExternalAPI\Sms\AbstractTemplate;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\ExternalAPI\Sms\Enum\SignEnum;
use App\Infrastructure\ExternalAPI\Sms\Enum\SmsTypeEnum;
use App\Infrastructure\ExternalAPI\Sms\Volcengine\Base\VolcengineTemplateIdEnum;
use RuntimeException;

class Template extends AbstractTemplate
{
    /**
     * 默认消息组ID.
     */
    public const string DEFAULT_MESSAGE_GROUP_ID = '77a48cb1';

    /**
     * 消息组支持的签名列表.
     */
    public static array $signToMessageGroup = ['灯塔引擎'];

    protected array $typeToIdMap = [
        LanguageEnum::ZH_CN->value => [
            SmsTypeEnum::VERIFICATION_WITH_EXPIRATION->value => VolcengineTemplateIdEnum::ST_79E262F3->value,
        ],
    ];

    protected array $idContents = [
        VolcengineTemplateIdEnum::ST_79E262F3->value => '您的验证码是：${verification_code}，有效期 ${timeout} 分钟。请在页面中输入验证码完成验证。如非本人操作，请忽略。',
    ];

    /**
     * 短消息模板Id与消息组的映射.
     */
    protected array $templateToGroupIdMap = [
        self::DEFAULT_MESSAGE_GROUP_ID => [
            VolcengineTemplateIdEnum::ST_79E25915->value,
        ],
    ];

    /**
     * 火山云短信的签名暂未支持国际化.
     */
    protected array $signMap = [
        '灯塔引擎' => [
            LanguageEnum::ZH_CN->value => '灯塔引擎',
            //            Language::EN_US => 'Light Engine',
        ],
        SignEnum::DENG_TA->value => [
            LanguageEnum::ZH_CN->value => '灯塔引擎',
            //            Language::EN_US => 'Light Engine',
        ],
    ];

    public function getMessageGroupId(string $templateId): string
    {
        foreach ($this->templateToGroupIdMap as $groupId => $templateIds) {
            if (in_array($templateId, $templateIds, true)) {
                return $groupId;
            }
        }
        return self::DEFAULT_MESSAGE_GROUP_ID;
    }

    /**
     * 根据传来的短信文本,解析变量. 只有变量的值,未匹配变量的key!
     * 需要变量解析的原因:火山短信只支持变量短信的发送,而业务方会出于创蓝短信的原因,会传来整个短信文本内容,没有变量.
     */
    public function smsVariableAnalyse(string $message, string $templateId, ?string $language): array
    {
        // 找到指定的模板变量正则解析规则. 如果没传模版id,循环正则匹配会降低匹配速度和准确度
        if ($templateId) {
            // 判断模板是否存在
            if (! isset($this->idContents[$templateId])) {
                throw new RuntimeException('未匹配到模板id:' . $templateId);
            }
            $pregMatch = $this->variablePregAnalyse[$language][$templateId] ?? '';
            // 如果根据短信内容匹配到了模板id,就变更传入的模板id的值
            $pregMatch && [$templateId, $matchedVariables] = $this->variablePregMatch([$templateId => $pregMatch], $message);
        } elseif (isset($this->variablePregAnalyse[$language])) {
            // 火山普通短信,且无法根据type + language 确定模板id,尝试根据短信文本内容 + language 确定模板id和变量
            [$templateId, $matchedVariables] = $this->variablePregMatch($this->variablePregAnalyse[$language], $message);
        }
        if (empty($templateId)) {
            throw new RuntimeException('未匹配到模板id');
        }
        if (empty($matchedVariables)) {
            throw new RuntimeException('短信的模板变量解析失败');
        }
        return [$templateId, $matchedVariables];
    }

    protected function getTemplateDefaultSignType(string $sign): string
    {
        return array_key_first(self::$signToMessageGroup) ?? '';
    }

    /**
     * @param array $pregVariableAnalyse ['模板id_xxx'=>'正则表达式']
     */
    private function variablePregMatch(array $pregVariableAnalyse, string $message): array
    {
        $matchedVariables = [];
        $matches = [];
        $templateId = null;
        foreach ($pregVariableAnalyse as $templateId => $pregTemplate) {
            if (preg_match($pregTemplate, $message, $matches)) {
                $matchedVariables = array_slice($matches, 1);
                break;
            }
        }
        return [$templateId, $matchedVariables];
    }
}
