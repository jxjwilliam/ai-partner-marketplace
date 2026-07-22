# 阿里云部署与上线检查

本文面向阿里云 ECS 或轻量应用服务器的单机部署。生产数据库建议使用同地域的 RDS PostgreSQL，不要把数据库直接暴露到公网。

## 1. 准备服务器

- 选择 Linux ECS/轻量应用服务器，并在安全组中仅开放 SSH、HTTP（80）和 HTTPS（443）。
- 安装 Node.js 20 或更高版本、Git、Nginx，以及 npm。
- 创建非 root 的应用用户和独立部署目录，例如 `/srv/ai-partner-marketplace`。
- 域名解析到服务器公网 IP；数据库白名单仅允许应用服务器内网地址。

```bash
node --version
git clone <repository-url> /srv/ai-partner-marketplace
cd /srv/ai-partner-marketplace
npm ci
```

## 2. 配置生产环境变量

以仓库中的 `.env.example` 为清单，在服务器创建只允许应用用户读取的 `.env`，不要提交真实密钥：

```bash
cp .env.example .env
chmod 600 .env
```

逐项设置以下变量：

- `DATABASE_URL`：RDS PostgreSQL 连接串，优先使用内网地址并启用强密码。
- `SESSION_SECRET`：生产专用的高强度随机值。
- `SMS_ACCESS_KEY_ID`、`SMS_ACCESS_KEY_SECRET`：仅授予短信发送所需的最小权限。
- `SMS_SIGN_NAME`、`SMS_TEMPLATE_CODE`：阿里云短信控制台审核通过的签名和验证码模板。
- `SMS_DRY_RUN=false`：生产环境必须显式关闭模拟发送；上线前先用真实大陆手机号验证。
- `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`：按实际模型服务配置。
- `ADMIN_PHONES`：逗号分隔的管理员手机号，不要沿用示例号码。

在阿里云短信控制台完成资质、签名和验证码模板审核，并检查套餐余量、发送频控和告警。切勿在日志中输出 AccessKey、完整验证码或手机号。

## 3. 构建、迁移与种子数据

部署新版本时先安装锁定依赖，再执行生产迁移和构建：

```bash
cd /srv/ai-partner-marketplace
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

首次上线可在确认连接的是正确生产库后导入演示内容：

```bash
npx prisma db seed
```

种子脚本会幂等写入两个虚构账号和演示帖子。正式邀请用户前检查内容是否展示正常。为 RDS 开启自动备份和按时间点恢复，并在迁移前创建手动快照；定期演练恢复流程。

## 4. 使用 PM2 或 systemd 运行

二选一即可。无论使用哪种方式，都应以普通应用用户运行，并让进程读取部署目录中的 `.env`。

### PM2

```bash
sudo npm install -g pm2
cd /srv/ai-partner-marketplace
pm2 start npm --name ai-partner-marketplace -- start
pm2 save
pm2 startup
```

按 `pm2 startup` 输出的提示执行一次系统启动命令。更新后运行 `pm2 restart ai-partner-marketplace --update-env`。

### systemd

创建 `/etc/systemd/system/ai-partner-marketplace.service`：

```ini
[Unit]
Description=AI Partner Marketplace
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=app
WorkingDirectory=/srv/ai-partner-marketplace
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/srv/ai-partner-marketplace/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

确认 `User`、Node/npm 路径和部署目录与服务器实际配置一致，然后启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ai-partner-marketplace
sudo systemctl status ai-partner-marketplace
```

## 5. Nginx 反向代理与 HTTPS

创建 `/etc/nginx/conf.d/ai-partner-marketplace.conf`：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Nginx 必须自行设置/覆盖 `X-Forwarded-For`（例如 `$remote_addr` 或 `$proxy_add_x_forwarded_for`），不可信任客户端传入的值。

替换域名，检查并重载配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

可使用阿里云数字证书管理服务签发的证书，或安装 Certbot 自动配置 Let's Encrypt：

```bash
sudo certbot --nginx -d example.com
```

启用 HTTPS 后确认 HTTP 自动跳转到 HTTPS、证书自动续期有效，且 3000 端口未向公网开放。

## 6. ICP 与运维注意事项

域名若通过中国大陆节点对公众提供网站服务，通常需先完成 ICP 备案；经营性服务还可能涉及 ICP 许可证等额外许可。备案要求以阿里云和主管部门的最新规则为准，未完成前不要将大陆服务器域名正式对外开放。

上线后至少配置应用进程、Nginx、磁盘、RDS 连接数与备份失败告警。发布失败时保留上一版本构建，优先回滚应用；涉及数据库迁移时按预先验证的恢复方案处理。

## 7. 手工上线检查清单

- [ ] 使用真实中国大陆手机号完成 OTP 登录。
- [ ] 四种发布模板都能成功发布，并可按类型、城市和标签正确筛选。
- [ ] 第二个账号发起联系方式解锁，作者批准后仅该申请人能看到联系方式。
- [ ] AI 润色结果可以采用或放弃；LLM 调用失败时仍可正常发布。
- [ ] 隐藏帖子后，它会从公开列表中移除。
- [ ] 在移动端 Safari 和微信内置浏览器中可正常使用。
- [ ] 邀请真实用户前，种子帖子已在生产环境展示。
