<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Sms;

use App\Infrastructure\ExternalAPI\Sms\Enum\SignEnum;

/**
 * 所有短信驱动的返回结果必须转换为此对象
 */
class SmsStruct
{
    /**
     * 手机号.
     */
    public string $phone = '';

    /**
     * 短信的类型,比如:registration_rewards (订单已发货),arrival_notice(到货通知).
     * 1.如果搭配 language 字段,同时使用变量短信,可以实现多语言适配,以及语种兜底
     * 2.电商的相关短信使用此字段,但是没有 language 传入.
     */
    public ?string $type = null;

    /**
     * 变量短信的变量内容. 可能为关联数组,也可能为索引数组.
     * @example {"product_name": "商品A", "payer": "供应商A","amount": 10}
     * @example ["商品A","供应商A",10]
     */
    public ?array $variables = null;

    /**
     * 普通短信的纯文本内容.
     * 如: 灯塔正在邀请你加入企业，点击链接注册或登录 https://xxxx.com/sso?r_ce=vB5932.
     */
    public ?string $content = null;

    /**
     * 短信签名.
     * @example 灯塔引擎
     */
    public SignEnum $sign;

    /**
     * 短信的语种,与type字段和变量短信搭配使用.
     */
    public ?string $language = null;

    /**
     * 短信的默认语种,支持业务方自定义. 不传给默认值zh_CN.
     */
    public ?string $defaultLanguage = null;

    /**
     * 短信变量的模板id.
     */
    public ?string $templateId = null;

    public function __construct(string $phone, array $variables, SignEnum $sign, string $templateId)
    {
        $this->setPhone($phone);
        $this->setVariables($variables);
        $this->setSign($sign);
        $this->setTemplateId($templateId);
    }

    public function getPhone(): string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): void
    {
        $this->phone = $phone;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): void
    {
        $this->type = $type;
    }

    public function getVariables(): ?array
    {
        return $this->variables;
    }

    public function setVariables(?array $variables): void
    {
        $this->variables = $variables;
    }

    public function getContent(): ?string
    {
        return $this->content;
    }

    public function setContent(?string $content): void
    {
        $this->content = $content;
    }

    public function getSign(): SignEnum
    {
        return $this->sign;
    }

    public function setSign(SignEnum $sign): void
    {
        $this->sign = $sign;
    }

    public function getLanguage(): ?string
    {
        return $this->language;
    }

    public function setLanguage(?string $language): void
    {
        $this->language = $language;
    }

    public function getDefaultLanguage(): ?string
    {
        return $this->defaultLanguage;
    }

    public function setDefaultLanguage(?string $defaultLanguage): void
    {
        $this->defaultLanguage = $defaultLanguage;
    }

    public function getTemplateId(): ?string
    {
        return $this->templateId;
    }

    public function setTemplateId(?string $templateId): void
    {
        $this->templateId = $templateId;
    }

    public function toArray(): array
    {
        return [
            'phone' => $this->getPhone(),
            'type' => $this->getType(),
            'variables' => $this->getVariables(),
            'language' => $this->getLanguage(),
        ];
    }
}
