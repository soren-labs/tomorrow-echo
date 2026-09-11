# Devin API 与测量方法

核查日期：2026-09-11。实验只计 Devin 创建的三个会话；仓库起点、人工协调和免费 review 单独标注，不混入开发结果。

## 调用方式

现有 WSL 配置在 `~/.config/devin/env`，包含 `DEVIN_V3_API_KEY`/`DEVIN_API_KEY` 和 `DEVIN_ORG_ID`。认证为 `Authorization: Bearer ...`；不提交密钥。当前凭证是 service user，若未提供 `create_as_user_id`，会话属于 service user，并非自动归到个人用户。这会影响套餐额度归属解读，不能擅自把 ACU 数等同个人额度扣减。

| 操作 | v3 路径（前缀 `/v3/organizations/{org}`） |
| --- | --- |
| 创建 | `POST /sessions` |
| 读状态/用量 | `GET /sessions/{id}` |
| 读 insights | `GET /sessions/{id}/insights` |
| 消息 | `GET/POST /sessions/{id}/messages` |
| 日消耗 | `GET /consumption/daily/sessions/devin-{id}` |
| PR review | `POST /pr-reviews`，body 为 `{pr_url}`；GET 用 `pr_url` 查询 |

`cog_` 支持 v3；旧 `apk_user_` 是 v1/v2。创建请求省略 `model` 和 `devin_mode`，继承用户已经设置的 **API default agent = SWE-2 Max**。当前公开 schema 无 model 字段，API 返回不能独立证明模型身份；用网页实际选择器确认，不能靠 agent 自报当证据。

## 本次顺序

```bash
source ~/.config/devin/env
python3 tools/devin_benchmark.py start frontend --run trial-20260911 --cap 10
python3 tools/devin_benchmark.py start backend --run trial-20260911 --cap 10
# 两者运行可重叠；分别记录返回 ID。
python3 tools/devin_benchmark.py status SESSION_ID --out artifacts/trial-20260911/frontend
# 两个 PR 准备好后，写 context.md，注明它们的 URL 和 HEAD：
python3 tools/devin_benchmark.py start integration --run trial-20260911 --cap 10 --context-file artifacts/context.md
```

API 没有记录在此版本文档中的创建幂等 key。脚本在 POST 前以独占方式保存 intent，失败后禁止同名重复启动；超时必须先查会话列表，不能删除标记后盲目重试。状态查询只读，不唤醒会话；send 会恢复暂停会话。

## 记录什么

- 三个会话分别记录 ID、创建/完成时间、PR 和部署 SHA。
- 原样保存 session `acus_consumed`、insights `acus_consumed` 和 daily `total_acus`，三者是交叉核对，**不能相加**。
- 缺失/403 标记 unavailable；0 保留 0，不宣称免费。input_tokens/output_tokens 用 null，API 未提供，禁止推算。
- 在网页 Settings > Plans 记录测试前后 included quota 和 on-demand balance；若不可读取，最终明确「未测得套餐额度差」，不编造。
- 并行窗口中的账号总消耗可能含其他任务；只把可归属的数据纳入实验。
- 分别在各阶段结束和账单延迟后查询。累计总消耗只加三条独立 session 的同一种指标；缺任何一条就报告部分总量。
- 每个会话初始 cap 10 ACU；它是 API 上限，不等于 10 美元，也不保证 SWE-2 的套餐百分比按相同比例计量。

## 公开 PR 免费 review

官方 billing 文档明确：任何人可在 `devinreview.com/OWNER/REPO/pull/N` review 公开 GitHub PR，无需 Devin 账号、不消耗 on-demand credits。自动 review 还要求仓库接入组织，不能因仓库公开就声称 GitHub 自动发评已经启用。本实验只按 PR 单独触发，不更改账号全局设置。

## 官方来源

- [Authentication](https://docs.devin.ai/api-reference/authentication)
- [Session API / attribution](https://docs.devin.ai/api-reference/overview)
- [Create session](https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions)
- [OpenAPI schema](https://docs.devin.ai/v3-openapi.yaml)
- [Usage](https://docs.devin.ai/admin/billing/usage)
- [Self-serve billing / public PR review](https://docs.devin.ai/admin/billing/self-serve)
- [Devin Review](https://docs.devin.ai/work-with-devin/devin-review)
