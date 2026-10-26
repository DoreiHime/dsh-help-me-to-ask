# 提问引导 · dsh-HelpMe-To-Ask

[简体中文](#简体中文) · [English](#english)

> 仓库：[github.com/DoreiHime/dsh-help-me-to-ask](https://github.com/DoreiHime/dsh-help-me-to-ask)

---

## 简体中文

你好呀，谢谢你点进来看。

做这个小插件的原因其实挺朴素的：我在 DSH 里干活的时候，经常一开始只说一句“帮我搞一下这个”，等模型吭哧吭哧做完，才发现方向不太对，又要推倒重来。后来就想，要是有个东西能在动手之前先轻轻问一句“你是想要 A 还是 B 呀”，大概能少很多来回。

所以有了它：回答之前，先帮你把话问清楚，再把你的回答整理成一张小小的「任务说明」（也可以理解成开工前的小单子），你确认之后才交给模型。就这些，没有别的了。

> **想直接用最新版？**
>
> 在 DSH 的插件安装输入框里填：
>
> ```
> dsh-help-me-to-ask@1.0.5
> ```
>
> 带版本号可以跳过 npm 新版本的 24 小时观察期；只写包名时，DSH 可能先给你装稍旧的 1.0.2。

### 它会做什么

每个聊天窗口里，当你发出**第一段真正的工作内容**时（纯寒暄不算），它会先弹一张卡片：

- 先复述一句“我理解你想做的是……”，让你看看有没有跑偏；
- 只问真正缺的东西：目标、交付物、范围限制、验收标准、有没有什么要特别注意的；
- 每个问题都尽量给出从你原话里推出来的具体选项，不太会问那种“请描述你的需求”的空话；
- 实在不想一项项选，可以点“一键明确目标”，让它自己补全。

你回答完（或者点了跳过），它会整理成一张很短的任务说明，大概长这样：

> 要做成什么 / 最后给你什么 / 限制（能改哪些、用什么）/ 怎样算做好 / 明确不碰的 / 没问到、先这样定

看一眼，确认、改一改、或者直接跳过。确认之后，模型就知道自己到底要做什么、做到什么程度算完成。

卡片出现时会响一声提示音（可在设置里关掉）；最多保留 10 分钟，底部有倒计时，填不完可以点「还没写完！+5 分钟」续时；填写内容会边写边暂存在本机，刷新页面或重启也能恢复。

### 什么时候会出现

插件启用、并且当前聊天窗口没有跳过时：

- **只在需求模糊时问**：第一段工作内容里，分析觉得缺目标 / 交付物 / 限制，才弹卡；
- **复杂任务也问**：第一段工作内容里，即使目标清楚，只要任务复杂也先确认关键细节；
- **跳过这个窗口**：当前聊天窗口里不再引导，其他窗口不受影响；
- **帮我一下**（金色）：只接管**当前聊天窗口的下一条消息**，不管它清晰、模糊还是寒暄，都会走一次确认流程；用完自动恢复原来的模式。

纯打招呼（你好、在吗、谢谢、哈哈、晚安等）不会触发，也不会消耗分析 token；等你说出真正想做的事，它才开始工作。

### 我不想被问的时候

输入框左边有个「提问引导」的小开关，点齿轮可以：

- 切换上面的提问时机；
- 本窗口跳过 / 帮我一下；
- 调最多追问几轮（1–10，默认 3）；
- 关掉“开始前先看任务说明”，直接开工。

它也不会一直追问下去。没有新的信息可问了，它会停，把剩下的细节写成“假设”，或者留给你和模型在聊天里慢慢补。

### 设置里还能改什么

设置 → 提问引导：

- **总开关**：不想用了随时关掉；
- **提问时机**：同上；
- **后续目标变化时提示更新任务说明**：只在你明确说“换个 / 改成 / 重新来”这类话时才会出现，不会每轮都打扰；
- **开始前先看任务说明**；
- **最多追问轮数**；
- **弹卡时响一声提示音**：不想被声音打扰可以关掉；
- **大脑模型**：插件自己分析需求时用的模型。默认自动选 DSH 里最新的 DeepSeek 模型 + Max 推理；也可以自己选客户端里任意可用的模型和推理档位。

### 怎么装

从插件市场看到这个页面的话，点安装就好。

想手动装的话：

```bash
dsh plugin add dsh-help-me-to-ask
```

**想直接装最新版**：在插件安装输入框里带版本号：

```
dsh-help-me-to-ask@1.0.5
```

这是因为 pnpm 默认会给新发布的版本一个 24 小时观察期；带准确版本号可以越过它。或者下载 release 里的 tgz 用本地安装。装好之后重启 DSH（或刷新页面），输入框左边就能看到它了。

### 一些说明

- 每个聊天窗口只处理**第一段真正的工作内容**；纯寒暄不触发，之后只有出现明显“改口”信号时才会提示更新任务说明，不会每轮都插话。
- 「帮我一下」是一次性的：只接管当前窗口的下一条消息，处理完自动恢复你原来的模式。
- 它不碰你的模型和推理档位设置。以前我做过一版会自动帮人切模型、切推理，后来发现身边几乎没人真的想为 DSH 选推理等级，就把它去掉了，只留下“问清楚”这件事。
- 正在执行任务的子智能体不会用到这个插件。
- 分析用的模型是你自己在设置里选的那个，调用方式和普通对话一样，数据不会额外传到别的地方。
- 聊天窗口里的任务说明只存在你自己电脑上：`$DSH_HOME/dsh-help-me-to-ask-sessions.json`。
- 它也有点笨的时候，如果问得不对、或者你觉得哪句话说得不清楚，欢迎告诉我，我慢慢改。

### 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

### 谢谢

写这个插件的时候被 DSH 的社区帮了很多，也谢谢愿意试用它的你。

如果有什么想跟我说的，可以发邮件到 **doreihime.cn@gmail.com**，我看到会回。

MIT License。

---

## English

Hi, thank you for stopping by.

The idea behind this little plugin is pretty simple: when I work in DSH, I often start with something vague like “help me fix this”, and only after the model has done a whole round of work do I realize the direction was off. So I thought: what if something asked me one gentle question *before* it starts — “did you mean A or B?” — that would save a lot of back-and-forth.

That’s all it does. Before answering, it helps you state your request clearly, turns your answers into a tiny **task sheet**, and waits for your confirmation before handing it to the model.

> **Want the newest version directly?**
>
> In the DSH plugin install field, enter:
>
> ```
> dsh-help-me-to-ask@1.0.5
> ```
>
> Pinning the exact version skips pnpm’s 24-hour release-age gate. With the bare package name, DSH may install the slightly older 1.0.2 first.

### What it does

In every chat window, on the **first real work message** (pure greetings don’t count), it shows a card first:

- It repeats back “here’s what I understand you want…”, so you can catch a misunderstanding early;
- It asks only for what’s genuinely missing: goal, deliverable, constraints, acceptance criteria, anything special to watch out for;
- Each question offers concrete options derived from your own words, instead of empty prompts like “please describe your requirements”;
- If you don’t feel like picking each item, press **One-click brief** and it fills in the gaps itself.

After you answer (or skip), it produces a very short task sheet:

> What to make / What you get / Limits (what may be touched, what to use) / How we know it’s done / What not to touch / Guesses for gaps

Check it, confirm, modify, or skip. Once confirmed, the model knows exactly what to do and what “done” means.

A short chime plays when the card appears (can be muted in settings). The card stays for up to 10 minutes with a visible countdown; press “Still writing · +5 min” to extend it. Answers are saved locally as you type, so a refresh or restart restores them.

### When it appears

When the plugin is enabled and this chat window isn’t skipped:

- **Only when the request is vague** — on the first real work message, ask first only if goal / deliverable / constraints are missing;
- **Also for complex tasks** — on the first real work message, confirm key details even when the goal is clear, if the task looks complex;
- **Skip this window** — no guidance in this chat window; other windows are unaffected;
- **Help me out once** (gold) — take over the **next message in this chat window**, whatever it is, run one confirmation pass, then return to the previous mode automatically.

Pure greetings (hi, hello, thanks, haha, good night…) never trigger it and never spend analysis tokens; it waits for real work intent.

### When it stays quiet

There’s a small **Ask Guide** switch on the left of the input box. Click the gear to:

- switch the trigger mode above;
- skip this window / help me out once;
- set the maximum number of follow-up rounds (1–10, default 3);
- turn off “review the task sheet before starting”.

It also stops on its own: when there is no genuinely new information left, it stops asking and either writes the remaining details as assumptions or leaves them to be resolved in the chat.

### Settings

Settings → Ask Guide:

- **Master switch** — turn it off whenever you like;
- **When to ask** — same as above;
- **Offer to update the task sheet when the goal changes** — only reacts to explicit change phrases (“instead”, “redo”, “change it to…”), never nags every turn;
- **Review the task sheet before starting**;
- **Max follow-up rounds**;
- **Play a chime when the form appears** — turn it off if you prefer silence;
- **Brain model** — the model used for the plugin’s own analysis. By default it auto-picks the newest DeepSeek model in DSH with Max reasoning; you can also choose any available model and reasoning level from the client.

### Install

From the plugin market: just click install.

Manually:

```bash
dsh plugin add dsh-help-me-to-ask
```

**To install the newest version directly**, pin the version in the install field:

```
dsh-help-me-to-ask@1.0.5
```

pnpm gives freshly published versions a 24-hour observation window by default; pinning the exact version bypasses it. You can also download the tgz from a release and install locally. Restart DSH (or refresh the page) and the switch will appear next to the input box.

### A few notes

- Each chat window handles only its **first real work message**; pure greetings don’t trigger it, and afterwards it only offers to update the task sheet when an explicit change-of-mind signal appears. It never interrupts every turn.
- **Help me out once** is one-shot: it takes over the next message in this chat window only, then restores your previous mode.
- It does not touch your model or reasoning-level settings. I once built a version that switched models/reasoning automatically; later I realized almost nobody actually wants to pick reasoning levels for DSH, so I removed it and kept only the “ask clearly first” part.
- Subagents doing work never use this plugin.
- The analysis model is the one you choose in settings; calls go through the same route as normal conversations, and no data is uploaded anywhere else.
- Task-sheet state lives only on your own machine: `$DSH_HOME/dsh-help-me-to-ask-sessions.json`.
- It can be a bit clumsy sometimes. If it asks the wrong thing or a sentence feels off, tell me and I’ll keep improving it.

### Changelog

See [CHANGELOG.md](CHANGELOG.md).

### Thanks

DSH’s community helped me a lot while building this, and thank you for giving it a try.

If you want to reach me, email **doreihime.cn@gmail.com** — I read it.

MIT License.
