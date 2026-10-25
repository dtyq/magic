# Admin reference multiplier preview

Shared, dependency-free preview utilities for both admin interfaces. This module does not calculate actual charges, route models, load platform prices, or provide business defaults.

## API contract

`model_billing_multiplier` contains:

- `enabled`: display switch.
- `currency`: CNY or USD, defaulted by the backend.
- `input_price`, `output_price`: nullable source decimal strings per million tokens in the selected currency. Each may be zero; their combined reference amount must be positive when enabled.
- `usd_to_cny_rate`: nullable decimal string. Defaults are supplied by the backend.
- `base_price_cny`: backend-calculated CNY amount for 10,000 input + 1,000 output tokens. The UI preserves this response field; editing never writes a computed preview into it.

USD reference amounts use the display exchange rate to convert to CNY. Currency switches preserve entered numbers. The write contract contains only enabled, currency, input_price, output_price and usd_to_cny_rate.

The API must persist the new token prices and return the calculated `base_price_cny`. The reference amount is read-only and cannot substitute for input/output prices. Deploy backend support before releasing this interface.

## Price examples

Official prices checked on 2026-10-15 are static explanatory snapshots, not live quotes, platform selling prices or an availability list. Source links are recorded next to each model. Context tiers are equally averaged; DeepSeek uses peak uncached prices without off-peak discounts. Adjusting the benchmark only changes example multipliers; adjusting the display exchange rate also changes CNY amounts.

# 管理端参考倍率预览

两个管理端共用无依赖的预览与校验逻辑，不处理扣费、模型路由、平台售价或业务默认值。

输入、输出基准单价以所选人民币或美元/百万 token 的十进制字符串保存，币种通过 `currency` 持久化。美元参考金额乘展示汇率后统一折算人民币；切换币种保留已填写数字；后端负责默认值与最终参考金额。前端只预览，不将计算结果覆盖到 `base_price_cny`。保存只提交标准单价字段，不提交旧别名或后端派生金额。

发布前需要后端支持保存 `currency`、`input_price`、`output_price`，并返回重新计算的 `base_price_cny`。示例为标注日期的官方价格快照；各档等权平均，不代替平台实际售价。
