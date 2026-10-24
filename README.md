# 提问引导 · dsh-HelpMe-To-Ask

你好呀，谢谢你点进来看。

做这个小插件的原因其实挺朴素的：我在 DSH 里干活的时候，经常一开始只说一句“帮我搞一下这个”，等模型吭哧吭哧做完，才发现方向不太对，又要推倒重来。后来就想，要是有个东西能在动手之前先轻轻问一句“你是想要 A 还是 B 呀”，大概能少很多来回。

所以有了它：回答之前，先帮你把话问清楚，再把你的回答整理成一张小小的任务简报，确认之后才交给模型。就这些，没有别的了。

## 它会做什么

新建对话时，如果你说的话比较笼统，它会先弹一张卡片：

- 先复述一句“我理解你想做的是……”，让你看看有没有跑偏；
- 只问真正缺的东西：目标、交付物、范围限制、验收标准、有没有什么要特别注意的；
- 每个问题都尽量给出从你原话里推出来的具体选项，不太会问那种“请描述你的需求”的空话；
- 实在不想一项项选，可以点“一键明确目标”，让它自己补全。

你回答完（或者点了跳过），它会整理成一份很短的简报：

> 目标 / 交付物 / 范围限制 / 验收标准 / 不做 / 假设

看一眼，确认、改一改、或者直接跳过。确认之后，模型就知道自己到底要做什么、做到什么程度算完成。

## 我不想被问的时候

输入框左边有个「提问引导」的小开关，点齿轮可以：

- 选什么时候问：只在需求模糊时问 / 复杂任务也问 / 每个新对话都问；
- 本会话跳过（只跳过当前这个对话，别的对话不受影响）；
- 调最多追问几轮（1–10，默认 3）；
- 关掉“开始前确认简报”，直接开工。

它也不会一直追问下去。没有新的信息可问了，它会停，把剩下的细节写成“假设”，或者留给你和模型在对话里慢慢补。

## 设置里还能改什么

设置 → 提问引导：

- **总开关**：不想用了随时关掉；
- **提问时机**：同上；
- **后续目标变化时提示更新简报**：只在你明确说“换个 / 改成 / 重新来”这类话时才会出现，不会每轮都打扰；
- **开始前确认简报**；
- **最多追问轮数**；
- **大脑模型**：插件自己分析需求时用的模型。默认自动选 DSH 里最新的 DeepSeek 模型 + Max 推理；也可以自己选客户端里任意可用的模型和推理档位。

## 怎么装

如果是从插件市场看到这个页面，点安装就好。

想手动装的话：

```bash
dsh plugin add dsh-help-me-to-ask
```

或者下载 release 里的 tgz，用本地安装。

装好之后重启一下 DSH（或者刷新页面），输入框左边就能看到它了。

## 一些说明

- 插件只在你**新建对话的第一条消息**，以及后面出现明显“改口”信号时才会出来；不会每轮都插话。
- 它不碰你的模型和推理档位设置。以前我做过一版会自动帮人切模型、切推理，后来发现身边几乎没人真的想为 DSH 选推理等级，就把它去掉了，只留下“问清楚”这件事。
- 正在执行任务的子智能体不会用到这个插件。
- 分析用的模型是你自己在设置里选的那个，调用方式和普通对话一样，数据不会额外传到别的地方。
- 会话里的简报状态只存在你自己电脑上：`$DSH_HOME/dsh-help-me-to-ask-sessions.json`。
- 它也有点笨的时候，如果问得不对、或者你觉得哪句话说得不清楚，欢迎告诉我，我慢慢改。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 谢谢

写这个插件的时候被 DSH 的社区帮了很多，也谢谢愿意试用它的你。

MIT License。

---

### English (short)

**dsh-HelpMe-To-Ask** is a DeepSeek Harness plugin that helps you state your request clearly *before* the model starts working. When a new conversation begins with a vague message, it asks only for the missing pieces (goal, deliverable, constraints, acceptance criteria), then turns your answers into a short, structured task brief that the model can actually follow.

No model routing, no hidden switches — just a calmer start. The UI is in Chinese; the plugin is MIT-licensed and all session data stays local.
