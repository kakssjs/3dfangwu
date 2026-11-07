# 注册邮箱验证与邮箱验证码登录

现有账户、手机号密码登录和装修联系方式继续复用。启用后，新注册必须提交邮箱及验证码；已有账户没有已验证邮箱时仍使用原手机号密码登录，不会仅凭输入邮箱自动绑定账户。短信接入已暂停。

## 配置发信服务

当前没有可用的发信邮箱，默认关闭邮箱功能，不发送真实邮件。准备支持 SMTP 的邮箱或邮件服务后，在服务器的 `studio/.env.local` 配置以下值。密码应使用服务商提供的 SMTP 授权码或应用密码，不放进源码、浏览器或公开聊天。

```dotenv
STUDIO_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=sender@example.com
SMTP_PASSWORD=replace-with-smtp-app-password
SMTP_FROM=sender@example.com
```

465 使用 TLS；使用 587 时设 `SMTP_SECURE=false`，客户端要求 STARTTLS，不能降级为明文。发件人应使用服务商允许的地址。生产启用前需要先配置网站域名与 HTTPS，确认发信服务的域名验证、配额和收件限制，并用自己控制的邮箱验证真实投递。重启 `irenovation` 后配置生效；启用但配置缺失会拒绝启动，不会悄悄绕过验证。临时关闭请显式设置 `STUDIO_EMAIL_ENABLED=false`，这会恢复原注册方式，既有邮箱信息保留。

## 用 Outlook 邮箱发信（g3168432265@outlook.com）

微软已关闭 Outlook.com 的「账号 + 密码」SMTP 登录，所以这里不用密码，而是用微软的 OAuth 授权：在微软注册一个应用拿到客户端 ID，再用发信邮箱本人授权一次「发送邮件」，网站保存一个可续期的授权文件。代码已完成（`src/api/auth/outlook.ts`、`scripts/outlook-authorize.ts`），剩下的都是一次性的账号操作，必须由邮箱主人自己完成。

**1. 先确认邮箱能正常用。** 用 g3168432265@outlook.com 登录一次 https://outlook.live.com ，按提示完成手机验证等安全检查。新注册、没验证过的账号，微软常会限制自动发信。

**2. 在微软注册一个应用（一次性）。** 用这个 Outlook 账号登录 https://entra.microsoft.com （或 https://portal.azure.com ；个人账号第一次进入可能要先建一个免费的默认目录）：

- 「应用注册」→「新注册」，名称随意（例如 Homora Mailer）；**支持的账户类型选「仅个人 Microsoft 账户」**；重定向 URI 不填。
- 注册后在「概述」里复制「应用程序(客户端) ID」，格式像 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`。
- 「身份验证」→ 高级设置「允许公共客户端流」选「是」→ 保存。授权脚本用的是设备代码流程，不打开这一项会失败。
- 微软后台的菜单名称会变，以实际界面为准。

**3. 在服务器的 `studio/.env.local` 填写（先保持关闭）：**

```dotenv
SMTP_AUTH_TYPE=outlook
SMTP_USER=g3168432265@outlook.com
SMTP_FROM=g3168432265@outlook.com
OUTLOOK_CLIENT_ID=第2步复制的客户端ID
# 授权文件默认保存在 runtime/outlook-smtp.json，可用 OUTLOOK_TOKEN_FILE 改位置
STUDIO_EMAIL_ENABLED=false
```

Outlook 模式下服务器地址、端口和加密方式固定为 `smtp-mail.outlook.com:587` + STARTTLS，不需要填 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_PASSWORD`。

**4. 授权一次。** 在服务器的 `studio` 目录运行：

```bash
npm run email:authorize
```

它会显示一个代码。在任意设备的浏览器打开 https://microsoft.com/devicelogin ，输入代码，**用 g3168432265@outlook.com 登录**并同意发送邮件。完成后脚本把授权保存到授权文件，终端里不会显示任何凭据。授权文件等同于发信权限，不要复制、提交或发给别人；改了邮箱密码或在微软账户里撤销了授权，就重新运行这一步。

**5. 发一封真实测试邮件。**

```bash
npm run email:test -- 你自己能收信的邮箱
```

显示 `Accepted by smtp-mail.outlook.com` 后，去那个邮箱（包括垃圾邮件箱）确认收到一封示例验证码（000000）。设置缺什么，命令会直接说出缺的那一项。

**6. 正式启用。** 把 `STUDIO_EMAIL_ENABLED` 改成 `true`，重启 `irenovation`。打开 `http://服务器地址/api/auth/email`，返回 `{"enabled":true}` 即生效，注册页会出现邮箱验证码，登录页出现「邮箱验证码登录」。

**需要知道的限制**

- 服务器在中国大陆，需要能访问 `login.microsoftonline.com` 和 `smtp-mail.outlook.com:587`。第 4、5 步就是在检验这一点：如果超时，说明服务器连不上微软。
- Outlook.com 个人邮箱是给个人用的，有每日发送上限（微软不公开固定数字，新账号更低），自动发出的验证码也可能进垃圾箱，账号还可能被临时限制。比赛演示和小规模试用可以；正式运营建议换成专门的发信服务。代码不用改，只换 `SMTP_*` 配置，但这类服务大多收费，需要你决定（`WORKFLOW.md` D9）。
- 网站本身的限流仍然生效：同一邮箱 60 秒 1 封、24 小时 5 封，同一 IP 每小时 5 封，全站每天 100 封。

## 接口与保护

- `GET /api/auth/email`：仅返回 `{enabled}`，不暴露 SMTP 配置。
- `POST /api/auth/email/code`：`{email,purpose:"register"|"login",acceptTerms:true}`；注册发送要求同意条款，登录无需传 `acceptTerms`。成功只返回 `{resendAfterSeconds:60}`。
- `POST /api/auth/register`：启用时在原注册字段上增加 `email`、`emailCode`。
- `POST /api/auth/email/login`：`{email,code}`，只登录已经验证该邮箱的账户。

验证码为随机 6 位数字，有效期 5 分钟，绑定邮箱及用途，一次消费；输错 5 次后当前码失效。摘要使用服务端密钥 HMAC；不记录明文验证码或发信密码。账号创建与验证码消费在同一数据库事务中完成。

发送额度持久化在现有数据库：同邮箱 60 秒一次、24 小时 5 次，同 IP 每小时 5 次，全站 24 小时 100 次。额度按各窗口起点滚动，不在服务重启时清零；发送失败或结果不明也消耗发送额度，避免超时重试造成重复投递。注册和登录共用邮箱发送额度，前端倒计时仅作提示，以后端为准。SMTP 错误只向用户返回通用失败信息。

使用 Nodemailer（MIT-0）发送标准 SMTP 邮件，不自行实现邮件协议。只新增邮件及其类型依赖，不引入第二套账户系统或缓存服务。

## 验证与部署

`npm test` 包含测试发信函数下的注册、登录、过期、重放、并发、配额、失败处理和手机宽度浏览器流程，不向真实邮箱发信。`npm run typecheck` 检查类型。新增数据库迁移仅添加可空邮箱字段、验证时间及验证码/限流表，保留所有已有用户与项目。

真实 SMTP 投递、垃圾邮件过滤、SPF/DKIM/DMARC 与发信域名审核需要服务商配置完成后单独验证。没有 SMTP 凭据时不可宣称真实发信已成功。
