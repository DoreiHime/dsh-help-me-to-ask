/**
 * 提问引导 / dsh-HelpMe-To-Ask — 宿主半侧：生成前提问 + 任务简报（不做模型/推理路由）。
 *
 * 新会话首条消息若宽泛/缺关键信息，用最强推理模型（默认自动选强模型 + Max）做需求分析，
 * 生成针对性澄清卡（目标/交付物/限制/验收/是否，多选 + 是否 + 个人想法），
 * 用户回答或"一键明确目标"后，生成结构化「任务简报」，确认后注入会话上下文。
 * 后续消息若出现目标漂移信号，提示更新简报。全部走本地卡片，不额外生成对话 token。
 */
import z from '@deepseek-ai/schemastery'
import { appendFile, readFile, stat } from 'node:fs/promises'
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const ROUTE_PREFIX = '/dsh-help-me-to-ask'
const VERSION = '1.0.3'

const DRIFT_SIGNAL_RE = /(换个|改成|改为|换方向|重新来|不是这个|不对|先停|算了|改主意|调整目标|另一个需求|重新做)/

// 纯打招呼不触发插件，等用户出现真正的工作意图（一次性接管除外）。
const GREETING_WORDS = [
  '你好', '您好', '在吗', '在不在', '在嘛', '嗨', '哈喽', 'hello', 'hi', 'hey',
  '早上好', '早安', '晚上好', '晚安', '谢谢', '感谢', '多谢', '辛苦了',
  '好的', 'thanks', 'thank you', 'ok', 'okay', '宝宝', '宝贝', '亲爱的', '好',
]
const GREETING_FILLER_RE = /(宝宝|宝贝|宝子|亲爱的|宝|亲|呀|啊|哦|呢|啦|嘛|哈|嘿|嗯|呜|哇|喵|滴|哒)/g
function isGreetingOnly(text) {
  if (typeof text !== 'string') return false
  let cleaned = text
    .toLowerCase()
    .replace(/[\s!！。,.，~～?？、…:：;；"'“”‘’()（）\[\]【】]/g, '')
  if (!cleaned || cleaned.length > 60) return false
  // 去掉所有问候词和语气/称呼填充词；只剩空空如也才认为是纯寒暄。
  for (const word of [...GREETING_WORDS].sort((a, b) => b.length - a.length)) {
    cleaned = cleaned.split(word).join('')
  }
  cleaned = cleaned.replace(GREETING_FILLER_RE, '')
  return cleaned.length === 0
}

export const name = 'dsh-help-me-to-ask'

export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  triggerMode: z.union([z.const('off'), z.const('vague'), z.const('complex'), z.const('always')])
    .default('vague')
    .volatile(),
  maxClarifyRounds: z.number().default(3).volatile(),
  watchTurns: z.boolean().default(true).volatile(),
  briefConfirm: z.boolean().default(true).volatile(),
  brainProvider: z.string().default('').volatile(),
  brainModel: z.string().default('').volatile(),
  brainEffort: z.string().default('').volatile(),
  cardClaimWaitMs: z.number().default(2500).volatile(),
})

/* ------------------------------------------------------------------ *
 * 日志 & 会话记忆
 * ------------------------------------------------------------------ */

function dshHome() {
  return typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME ? process.env.DSH_HOME : join(homedir(), '.dsh')
}
function logPath() {
  return join(dshHome(), 'dsh-help-me-to-ask.log')
}

function createDiag(ctx) {
  let queue = Promise.resolve()
  let announced = false
  return (event, data) => {
    const record = { t: new Date().toISOString(), event, ...(data ?? {}) }
    let line
    try {
      line = JSON.stringify(record) + '\n'
    } catch {
      return
    }
    queue = queue
      .then(() => appendFile(logPath(), line, 'utf8'))
      .then(() => {
        if (announced) return
        announced = true
        try {
          ctx.logger?.info?.(`dsh-help-me-to-ask: diagnostics at ${logPath()}`)
        } catch {}
      })
      .catch(() => {})
  }
}

function createSessionStore(ctx) {
  const file = join(dshHome(), 'dsh-help-me-to-ask-sessions.json')
  const map = new Map()
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    for (const [id, value] of Object.entries(raw ?? {})) map.set(id, normalizeEntry(value))
  } catch {}
  const persist = () => {
    try {
      writeFileSync(file, JSON.stringify(Object.fromEntries([...map.entries()].slice(-300))), 'utf8')
    } catch (error) {
      try {
        ctx.logger?.warn?.(`dsh-help-me-to-ask: session store save failed: ${String(error)}`)
      } catch {}
    }
  }
  return {
    get(sessionId) {
      return normalizeEntry(map.get(sessionId))
    },
    set(sessionId, patch) {
      const next = normalizeEntry({ ...normalizeEntry(map.get(sessionId)), ...patch, updatedAt: Date.now() })
      map.set(sessionId, next)
      persist()
      return next
    },
  }
}
function normalizeEntry(value) {
  return {
    skipClarify: value?.skipClarify === true,
    onceArmed: value?.onceArmed === true,
    intentHandled: value?.intentHandled === true,
    brief: value?.brief && typeof value.brief === 'object' ? value.brief : undefined,
    updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : undefined,
  }
}

/**
 * 一次性接管状态：global，不写进插件配置（宿主只能读配置，写回由客户端做）。
 * armed=true 时，下一次符合条件的新对话会强制走一遍提问流程，随后自动关闭。
 * fallback 记录激活前的模式，供界面回显/兜底。
 */
function oncePath() {
  return join(dshHome(), 'dsh-help-me-to-ask-once.json')
}
function readOnce() {
  try {
    const raw = JSON.parse(readFileSync(oncePath(), 'utf8'))
    return {
      armed: raw?.armed === true,
      fallback: typeof raw?.fallback === 'string' ? raw.fallback : 'vague',
      updatedAt: typeof raw?.updatedAt === 'number' ? raw.updatedAt : undefined,
    }
  } catch {
    return { armed: false, fallback: 'vague' }
  }
}
function writeOnce(next) {
  try {
    writeFileSync(oncePath(), JSON.stringify({ ...next, updatedAt: Date.now() }), 'utf8')
  } catch {}
}
function consumeOnce() {
  const current = readOnce()
  if (current.armed) writeOnce({ armed: false, fallback: current.fallback })
  return current
}

function isSubagentSession(agent) {
  try {
    const header = agent?.session?.header
    if (!header) return false
    if (header.origin === 'subagent') return true
    if (header.parentSession !== undefined && header.parentSession !== null) return true
    if (typeof header.parentSessionId === 'string' && header.parentSessionId !== '') return true
  } catch {}
  return false
}

/* ------------------------------------------------------------------ *
 * 插件入口
 * ------------------------------------------------------------------ */

export function apply(ctx, config) {
  const diag = createDiag(ctx)
  const seen = new WeakSet()
  const pendings = new Map()
  const sessions = createSessionStore(ctx)
  const log = (level, message) => {
    try {
      const sink = ctx.logger?.[level]
      if (typeof sink === 'function') sink.call(ctx.logger, `dsh-help-me-to-ask: ${message}`)
    } catch {}
    if (level !== 'info') diag('warn', { message })
  }

  diag('loaded', { version: VERSION, config: readConfigSnapshot(config) })

  ctx.effect(() => {
    const disposers = new Map()
    const offCreated = ctx.on('agent/created', ({ agent }) => {
      if (!agent || disposers.has(agent)) return
      if (isSubagentSession(agent)) {
        diag('skip-agent', { sessionId: idOf(agent), reason: 'subagent' })
        return
      }
      try {
        diag('agent-created', { sessionId: idOf(agent) })
        const dispose = agent.ctx.on('agent/pre-step', (payload, next) =>
          handlePreStep(ctx, config, seen, pendings, sessions, agent, payload, next, log, diag),
        )
        disposers.set(agent, dispose)
      } catch (error) {
        log('warn', `hook failed: ${errorText(error)}`)
      }
    })
    const offDisposed = ctx.on('agent/disposed', ({ agent }) => {
      const dispose = disposers.get(agent)
      if (dispose === undefined) return
      disposers.delete(agent)
      try {
        dispose()
      } catch {}
    })
    return () => {
      offCreated()
      offDisposed()
      for (const dispose of disposers.values()) {
        try {
          dispose()
        } catch {}
      }
      disposers.clear()
    }
  }, 'dsh-help-me-to-ask: per-agent hooks')

  try {
    ctx.inject(['webServer'], (child) => {
      try {
        child.effect(
          () =>
            child.webServer.register({
              kind: 'prefix',
              path: ROUTE_PREFIX,
              handler: (req, res) => handleRoute(ctx, config, pendings, sessions, req, res, diag),
            }),
          'dsh-help-me-to-ask: http route',
        )
      } catch (error) {
        log('warn', `route unavailable: ${errorText(error)}`)
      }
    })
  } catch (error) {
    log('warn', `route unavailable: ${errorText(error)}`)
  }

  try {
    ctx.logger?.info?.(`dsh-help-me-to-ask: loaded v${VERSION}`)
  } catch {}
}

/* ------------------------------------------------------------------ *
 * pre-step 主流程
 * ------------------------------------------------------------------ */

async function handlePreStep(ctx, config, seen, pendings, sessions, agent, payload, next, log, diag) {
  const sessionId = idOf(agent)
  try {
    const { messages, turn, step, signal } = payload ?? {}
    if (step !== 1) return next()
    if (config.enabled.get() !== true) return next()
    if (signal?.aborted) return next()
    if (!isRootAgent(ctx, agent)) return next()
    const store = sessions.get(sessionId)
    const onceArmed = store.onceArmed === true
    if (store.skipClarify && !onceArmed) {
      diag('skip', { sessionId, reason: 'session-skip' })
      return next()
    }
    const text = extractUserText(messages, config)
    if (!text) return next()

    // 纯打招呼不触发，省 token；等用户出现工作意图再说（“帮我一下”一次性接管除外）。
    if (!onceArmed && isGreetingOnly(text)) {
      diag('skip', { sessionId, turn, reason: 'greeting-only' })
      return next()
    }

    // 已有简报的后续消息：只处理“改口”提示（一次性接管走完整流程）。
    if (turn !== 1 && !onceArmed && store.brief) {
      if (config.watchTurns.get() !== true) return next()
      if (!DRIFT_SIGNAL_RE.test(text)) return next()
      if (seen.has(agent.session + ':drift:' + String(turn))) return next()
      seen.add(agent.session + ':drift:' + String(turn))
      const updated = await buildBrief(ctx, config, { text, answers: undefined, brief: store.brief, diag, mode: 'drift' })
      if (!updated) return next()
      const outcome = await requestInteraction(ctx, config, pendings, agent, signal, 'brief', { brief: updated, mode: 'drift' }, diag)
      if (outcome.type !== 'answer') return next()
      if (outcome.action === 'apply') {
        sessions.set(sessionId, { brief: updated })
        return finishMessages(await next(), [briefMessage(updated)])
      }
      return next()
    }

    // 每个会话只处理“第一段有意义的工作内容”；问候之后才出现也可以。
    if (!onceArmed) {
      if (store.intentHandled === true) return next()
      if (config.triggerMode.get() === 'off') {
        diag('skip', { sessionId, reason: 'trigger-off' })
        return next()
      }
      if (turn === 1 && !shouldTrigger(config, diag, text, sessionId)) return next()
    }

    const analysis = await analyze(ctx, config, { text, diag })
    if (!analysis) return next()
    diag('analyze', { sessionId, analysis })
    const mode = config.triggerMode.get()
    const shouldAsk = onceArmed
      ? true
      : analysis.needClarify === true || (mode === 'complex' && analysis.complexity === 'high')
    // 本会话的“首段工作内容”已处理；一次性接管同时自动关闭。
    sessions.set(sessionId, onceArmed ? { onceArmed: false, intentHandled: true } : { intentHandled: true })
    if (onceArmed) diag('once', { sessionId, turn })
    if (!shouldAsk) {
      diag('skip', { sessionId, reason: 'no-clarify-needed', mode, complexity: analysis.complexity })
      return next()
    }

    const maxRounds = clampInt(config.maxClarifyRounds.get(), 1, 10, 2)
    let answers
    let autoBrief = false
    let currentAnalysis = analysis
    const askedDims = new Set()
    for (let round = 0; round < maxRounds; round += 1) {
      for (const dimension of currentAnalysis.missing ?? []) askedDims.add(dimension)
      const outcome = await requestInteraction(
        ctx,
        config,
        pendings,
        agent,
        signal,
        'clarify',
        { analysis: currentAnalysis, round },
        diag,
      )
      if (outcome.type !== 'answer') return next()
      const value = outcome.value ?? {}
      if (value.skip === true) return next()
      if (value.autoBrief === true) {
        autoBrief = true
        break
      }
      answers = { ...(answers ?? {}), ...value }
      if (round + 1 >= maxRounds) break
      currentAnalysis = await refineAnalysis(ctx, config, {
        text,
        answers,
        analysis: currentAnalysis,
        round: round + 1,
        askedDims: [...askedDims],
        diag,
      })
      if (!currentAnalysis || currentAnalysis.needClarify !== true) {
        diag('clarify-stop', { sessionId, reason: 'brain-says-enough', round })
        break
      }
      const newDims = (currentAnalysis.missing ?? []).filter((dimension) => !askedDims.has(dimension))
      // 没有"新维度"可问 → 立即停止追问（不重复问同一件事），
      // 剩余细节写成简报假设，或留给模型在执行中自己问。
      if (newDims.length === 0) {
        diag('clarify-stop', { sessionId, reason: 'no-new-dimension', round, missing: currentAnalysis.missing })
        break
      }
    }

    const brief = autoBrief
      ? await buildBrief(ctx, config, { text, answers: undefined, diag, mode: 'auto' })
      : await buildBrief(ctx, config, { text, answers, diag, mode: 'answers' })
    if (!brief) return next()

    let finalBrief = brief
    if (config.briefConfirm.get() === true) {
      const outcome = await requestInteraction(ctx, config, pendings, agent, signal, 'brief', { brief, mode: 'first' }, diag)
      if (outcome.type !== 'answer') return next()
      if (outcome.action === 'apply') {
        finalBrief = brief
      } else if (outcome.action === 'edit') {
        const second = await requestInteraction(ctx, config, pendings, agent, signal, 'clarify', { analysis, round: 0 }, diag)
        if (second.type !== 'answer' || second.value?.skip === true) return next()
        const rebuilt = await buildBrief(ctx, config, { text, answers: second.value ?? {}, diag, mode: 'answers' })
        if (!rebuilt) return next()
        finalBrief = rebuilt
      } else {
        return next()
      }
    }

    diag('brief', { sessionId, brief: finalBrief })
    sessions.set(sessionId, { brief: finalBrief })
    return finishMessages(await next(), [briefMessage(finalBrief)])
  } catch (error) {
    diag('error', { sessionId, message: errorText(error), stack: error instanceof Error ? error.stack : undefined })
    log('warn', `pre-step skipped: ${errorText(error)}`)
    return next()
  }
}

function finishMessages(decision, messages) {
  if (decision === undefined || decision.kind !== 'enter' || !Array.isArray(decision.messages)) return decision
  return { ...decision, messages: [...decision.messages, ...messages] }
}

function briefMessage(brief) {
  const lines = ['[当前聊天窗口 · 任务说明]']
  if (brief.goal) lines.push(`目标：${brief.goal}`)
  if (brief.deliverable) lines.push(`交付物：${brief.deliverable}`)
  if (Array.isArray(brief.constraints) && brief.constraints.length) lines.push(`范围/限制：${brief.constraints.join('；')}`)
  if (Array.isArray(brief.acceptance) && brief.acceptance.length) lines.push(`验收标准：${brief.acceptance.join('；')}`)
  if (Array.isArray(brief.outOfScope) && brief.outOfScope.length) lines.push(`不做：${brief.outOfScope.join('；')}`)
  if (Array.isArray(brief.assumptions) && brief.assumptions.length) lines.push(`假设：${brief.assumptions.join('；')}`)
  lines.push('（以上由「提问引导」在生成前与你确认；后续回复请围绕这份任务说明展开。目标变化时可以更新它。）')
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: lines.join('\n') }],
    source: { kind: 'runtime-context' },
  }
}

function shouldTrigger(config, diag, text, sessionId) {
  const mode = config.triggerMode.get()
  if (mode === 'off') {
    diag('skip', { sessionId, reason: 'trigger-off' })
    return false
  }
  if (mode === 'always') return true
  return text.length <= 4000
}

function extractUserText(messages) {
  const parts = []
  for (const message of messages ?? []) {
    if (!message || message.role !== 'user') continue
    if (message.source?.kind === 'runtime-context') continue
    for (const block of message.content ?? []) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) parts.push(block.text.trim())
    }
  }
  return parts.join('\n').trim().slice(0, 4000)
}

function isRootAgent(ctx, agent) {
  try {
    if (isSubagentSession(agent)) return false
    const live = ctx.get('agents')?.get?.(agent.id)
    if (live !== undefined && live !== agent) return false
  } catch {}
  return true
}

/* ------------------------------------------------------------------ *
 * 大脑：最强推理模型 + Max
 * ------------------------------------------------------------------ */

let catalogCache = { at: 0, value: [] }

async function getCatalog(ctx, signal) {
  const now = Date.now()
  if (catalogCache.value.length > 0 && now - catalogCache.at < 120_000) return catalogCache.value
  const llm = ctx.get('llm')
  if (!llm) return []

  // 目录 = 已注册 adapter 的 provider（可调用）∪ 可配置 provider（目录声明）。
  // 这样无论用户装了哪些第三方模型插件，只要它在 DSH 里可用，就会被读出来。
  const providers = []
  const seen = new Set()
  const addProvider = (id, label) => {
    if (typeof id !== 'string' || id === '' || seen.has(id)) return
    seen.add(id)
    providers.push({ id, label: typeof label === 'string' && label !== '' ? label : id })
  }
  try {
    for (const entry of llm.listProviders?.() ?? []) addProvider(entry?.id, entry?.name)
  } catch {}
  try {
    for (const entry of llm.listConfigurableProviders?.() ?? []) {
      addProvider(entry?.provider, entry?.displayName ?? entry?.provider)
    }
  } catch {}

  const groups = []
  for (const provider of providers) {
    let models = []
    try {
      models = (await llm.listModels(provider.id)) ?? []
    } catch {
      continue // 未激活 / 无可用凭据的 provider 直接跳过
    }
    if (!Array.isArray(models) || models.length === 0) continue
    const detailed = []
    for (const model of models.slice(0, 80)) {
      if (!model?.id) continue
      let info = model
      try {
        // 推理档位只能通过 resolveModelInfo 拿到；给单个模型加超时，避免拖慢设置页。
        info = (await withTimeout(llm.resolveModelInfo(provider.id, model.id, signal), 1200)) ?? model
      } catch {}
      const reasoning = info?.reasoning
      const efforts = Array.isArray(reasoning?.efforts)
        ? reasoning.efforts
            .filter((effort) => effort && typeof effort.id === 'string' && effort.id)
            .map((effort) => ({ id: effort.id, name: typeof effort.name === 'string' ? effort.name : effort.id }))
        : []
      const defaultEffort =
        typeof reasoning?.defaultEffort === 'string' && efforts.some((effort) => effort.id === reasoning.defaultEffort)
          ? reasoning.defaultEffort
          : undefined
      detailed.push({
        provider: provider.id,
        id: model.id,
        name: info?.name ?? model.name ?? model.id,
        description: typeof info?.description === 'string' ? info.description : typeof model.description === 'string' ? model.description : undefined,
        efforts,
        defaultEffort,
      })
    }
    if (detailed.length > 0) groups.push({ provider: provider.id, label: provider.label, models: detailed })
  }
  if (groups.length > 0) catalogCache = { at: now, value: groups }
  return groups
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve(undefined)
    }, ms)
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(undefined)
      },
    )
  })
}

function allModels(catalog) {
  const models = []
  for (const group of catalog) for (const model of group.models) models.push(model)
  return models
}

function modelVersionScore(entry) {
  const text = `${entry?.id ?? ''} ${entry?.name ?? ''}`
  const match = /(?:^|[^a-z])v(\d+(?:\.\d+)*)/i.exec(text) || /(\d+\.\d+)/.exec(text)
  if (!match) return [0]
  return match[1].split('.').map((part) => Number(part) || 0)
}

function compareVersions(left, right) {
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const a = left[i] ?? 0
    const b = right[i] ?? 0
    if (a !== b) return b - a
  }
  return 0
}

function strengthScore(entry) {
  const text = `${entry?.id ?? ''} ${entry?.name ?? ''} ${entry?.description ?? ''}`
  if (/pro|opus|ultra|reasoner|thinking|r1/i.test(text)) return 3
  return 0
}

function isDeepSeekModel(entry) {
  const text = `${entry?.provider ?? ''} ${entry?.id ?? ''} ${entry?.name ?? ''} ${entry?.description ?? ''}`
  return /deepseek/i.test(text)
}

/**
 * 大脑选型（除非用户显式配置）：
 * 1) 永远优先 DeepSeek DSH 自带模型，取版本最新的一代（V4.1 > V4；同代取推理更强的）；
 * 2) 没有 DeepSeek 可用时，才回退到其他厂商里最新的一代；
 * 3) 推理档优先 max，其次该模型最高档。
 */
async function resolveBrain(ctx, config, catalog, signal) {
  const llm = ctx.get('llm')
  if (!llm) return undefined
  const candidates = []
  const p = config.brainProvider.get().trim()
  const m = config.brainModel.get().trim()
  if (p && m) candidates.push({ provider: p, model: m, effort: config.brainEffort.get().trim() || undefined })

  const rank = (entry) => ({
    entry,
    deepseek: isDeepSeekModel(entry) ? 1 : 0,
    version: modelVersionScore(entry),
    strength: strengthScore(entry),
  })
  const sortRanked = (a, b) =>
    b.deepseek - a.deepseek ||
    compareVersions(a.version, b.version) ||
    b.strength - a.strength ||
    String(a.entry.id).localeCompare(String(b.entry.id))
  for (const item of allModels(catalog).map(rank).sort(sortRanked)) {
    candidates.push({ provider: item.entry.provider, model: item.entry.id })
  }
  try {
    const fallback = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (fallback?.provider && fallback?.model) candidates.push({ provider: fallback.provider, model: fallback.model })
  } catch {}

  for (const candidate of candidates) {
    const entry = allModels(catalog).find((x) => x.provider === candidate.provider && x.id === candidate.model)
    if (!entry) continue
    try {
      await llm.resolveModelInfo(candidate.provider, candidate.model, signal)
    } catch {
      continue
    }
    const ids = entry.efforts.map((effort) => effort.id)
    let effort = candidate.effort
    if (effort && !ids.includes(effort)) effort = undefined
    if (!effort) effort = ids.includes('max') ? 'max' : ids[ids.length - 1]
    return { provider: entry.provider, model: entry.id, ...(effort ? { reasoningEffort: effort } : {}), label: entry.name }
  }
  return undefined
}

const BRAIN_TIMEOUT_MS = 45000
// 最大推理档会消耗较多 reasoning token；预算太小会在 JSON 写完前被 max-tokens 截断。
const BRAIN_TOKEN_BUDGETS = [4096, 12000]

async function brainCall(ctx, config, { system, prompt, diag }) {
  const llm = ctx.get('llm')
  if (!llm || typeof llm.stream !== 'function') return undefined
  const catalog = await getCatalog(ctx, undefined)
  const route = await resolveBrain(ctx, config, catalog, undefined)
  if (!route) {
    diag('brain', { error: 'no-route' })
    return undefined
  }
  for (let attempt = 0; attempt < BRAIN_TOKEN_BUDGETS.length; attempt += 1) {
    const maxTokens = BRAIN_TOKEN_BUDGETS[attempt]
    const controller = new AbortController()
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error('brain timeout'))
      } catch {}
    }, BRAIN_TIMEOUT_MS)
    let output = ''
    let finish
    try {
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        ...(route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {}),
        temperature: 0,
        maxTokens,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') output += chunk.text
        else if (chunk?.type === 'finish') finish = chunk.reason
      }
      if (finish !== undefined && finish?.kind !== 'stop') {
        diag('brain', { error: 'bad-finish', attempt, finish, route, maxTokens })
        if (finish?.kind === 'max-tokens' && attempt + 1 < BRAIN_TOKEN_BUDGETS.length) continue
        return undefined
      }
      const parsed = parseJsonObject(output)
      diag('brain', { route, attempt, maxTokens, parsed: parsed ?? null })
      if (parsed) return parsed
      if (attempt + 1 < BRAIN_TOKEN_BUDGETS.length) continue
      return undefined
    } catch (error) {
      diag('brain', { error: errorText(error), attempt, route, maxTokens })
      return undefined
    } finally {
      clearTimeout(timer)
    }
  }
  return undefined
}

const ANALYZE_SYSTEM =
  '你是需求分析助手，只输出严格 JSON。你唯一的目标是：让用户用最少的补充，就能得到"模型确切知道自己要做什么"的任务简报。'

function analyzePrompt(text) {
  return [
    '分析用户的第一条消息，输出 JSON：',
    '{',
    '  "understanding": "用一句话复述你理解用户想做什么（中文，<=30字）",',
    '  "clarity": "clear|vague",',
    '  "complexity": "low|medium|high",',
    '  "needClarify": true|false,',
    '  "missing": ["goal","deliverable","constraints","acceptance","context"],',
    '  "goalOptions": ["3个具体目标选项（从用户原话推导，不要通用模板）"],',
    '  "deliverableOptions": ["3个具体交付物形态选项"],',
    '  "constraintOptions": ["3个具体限制/范围选项（多选）"],',
    '  "acceptanceOptions": ["3个可验证的验收标准选项（多选）"],',
    '  "yesNo": [{"id":"...","question":"一个是否问题","default":true}],',
    '  "reason": "为什么需要或不需要澄清（一句话）"',
    '}',
    '规则：',
    '- 只有真正缺失、且会影响结果的信息才算 missing；能从消息推断的不要列为 missing。',
    '- 选项必须结合用户原话（例如提到游戏/项目/文档时要具体），不要泛泛而谈。',
    '- 如果目标与交付物已经足够明确，needClarify=false 且 missing=[]。',
    '',
    '用户消息：',
    '"""',
    text,
    '"""',
  ].join('\n')
}

async function analyze(ctx, config, { text, diag }) {
  const parsed = await brainCall(ctx, config, { system: ANALYZE_SYSTEM, prompt: analyzePrompt(text), diag })
  if (!parsed || typeof parsed !== 'object') {
    // 分析服务偶发失败（超时/截断）时不再静默跳过，给一张最小澄清卡让用户补目标。
    diag('analyze-fallback', { textLength: text.length })
    return {
      understanding: '',
      clarity: 'vague',
      complexity: 'medium',
      needClarify: true,
      missing: ['goal', 'deliverable'],
      goalOptions: [],
      deliverableOptions: [],
      constraintOptions: [],
      acceptanceOptions: [],
      yesNo: [],
      reason: '自动分析暂时不可用，先手动确认一下目标。',
    }
  }
  return normalizeAnalysis(parsed)
}

function normalizeAnalysis(parsed, fallback) {
  const asStrings = (value, limit = 4) =>
    Array.isArray(value) ? value.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, limit) : []
  return {
    understanding: typeof parsed.understanding === 'string' ? parsed.understanding.slice(0, 120) : fallback?.understanding ?? '',
    clarity: parsed.clarity === 'clear' ? 'clear' : 'vague',
    complexity: ['low', 'medium', 'high'].includes(parsed.complexity) ? parsed.complexity : fallback?.complexity ?? 'medium',
    needClarify: parsed.needClarify === true,
    missing: Array.isArray(parsed.missing) ? parsed.missing.filter((x) => typeof x === 'string').slice(0, 5) : [],
    goalOptions: asStrings(parsed.goalOptions),
    deliverableOptions: asStrings(parsed.deliverableOptions),
    constraintOptions: asStrings(parsed.constraintOptions),
    acceptanceOptions: asStrings(parsed.acceptanceOptions),
    yesNo: Array.isArray(parsed.yesNo)
      ? parsed.yesNo
          .filter((q) => q && typeof q.question === 'string')
          .slice(0, 3)
          .map((q, index) => ({ id: typeof q.id === 'string' ? q.id : `q${index + 1}`, question: q.question, default: q.default !== false }))
      : fallback?.yesNo ?? [],
    reason: typeof parsed.reason === 'string' ? parsed.reason : fallback?.reason,
  }
}

async function refineAnalysis(ctx, config, { text, answers, analysis, round, askedDims, diag }) {
  const prompt = [
    `这是第 ${(round ?? 1) + 1} 轮补充。判断"是否真的还有必须现在问、且会改变交付物的信息"；不要为了追问而追问。`,
    '规则：',
    '- 只问此前从未问过的维度（已问维度：' + JSON.stringify(askedDims ?? []) + '），禁止重复问同一件事；',
    '- 如果剩余细节可以写成「合理假设」，或模型在执行中自己能问，请返回 needClarify=false，把它们留给模型；',
    '- 第 3 轮以后：除非是新发现的、会显著改变交付物的关键点，否则一律返回 needClarify=false；',
    '- missing 里只放仍缺且会改变结果的维度，最多 2 个；',
    '输出 JSON：{"needClarify": true|false, "missing": ["..."], "understanding": "一句话", "goalOptions":["..."],"deliverableOptions":["..."],"constraintOptions":["..."],"acceptanceOptions":["..."],"yesNo":[{"id":"...","question":"...","default":true}]}',
    '原始消息：',
    text,
    '',
    '用户补充：',
    JSON.stringify(answers ?? {}).slice(0, 2000),
    '',
    '之前分析：',
    JSON.stringify({ missing: analysis?.missing, understanding: analysis?.understanding }).slice(0, 800),
  ].join('\n')
  const parsed = await brainCall(ctx, config, { system: ANALYZE_SYSTEM, prompt, diag })
  if (!parsed || typeof parsed !== 'object') return analysis
  return normalizeAnalysis({ ...analysis, ...parsed }, analysis)
}

const BRIEF_SYSTEM =
  '你是任务简报生成器，只输出严格 JSON。简报要简洁、无歧义，让另一个模型看完就知道：做什么、交付什么、怎么算完成。'

function briefPrompt({ text, answers, mode, brief }) {
  return [
    mode === 'drift'
      ? '用户可能改变了目标。基于旧简报与新消息，生成更新后的任务简报；如果其实没变，保持旧简报内容。'
      : '根据用户消息与补充信息，生成任务简报 JSON：',
    '{',
    '  "summary": "一句话概括（<=40字）",',
    '  "goal": "要达成的目标（一句，明确具体）",',
    '  "deliverable": "最终交付物形态（具体：文件/代码/文档/方案…）",',
    '  "constraints": ["范围与限制，最多4条，每条<=20字"],',
    '  "acceptance": ["可验证的验收标准，最多4条，每条<=20字"],',
    '  "outOfScope": ["明确不做的内容，最多3条，可空"],',
    '  "assumptions": ["信息不足处的合理假设，最多3条，可空"]',
    '}',
    '要求：只在确有必要时保留假设；验收标准必须可检查；不要空话。',
    '',
    '原始消息：',
    text,
    '',
    '用户补充（JSON，可能为空）：',
    JSON.stringify(answers ?? {}).slice(0, 2500),
    mode === 'drift' ? '\n旧简报：\n' + JSON.stringify(brief ?? {}).slice(0, 2000) : '',
  ].join('\n')
}

async function buildBrief(ctx, config, { text, answers, brief, diag, mode }) {
  const parsed = await brainCall(ctx, config, { system: BRIEF_SYSTEM, prompt: briefPrompt({ text, answers, mode, brief }), diag })
  if (!parsed || typeof parsed !== 'object') return undefined
  const normalize = (value) =>
    Array.isArray(value)
      ? value.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)).slice(0, 4)
      : []
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 80) : undefined,
    goal: typeof parsed.goal === 'string' ? parsed.goal.slice(0, 200) : undefined,
    deliverable: typeof parsed.deliverable === 'string' ? parsed.deliverable.slice(0, 200) : undefined,
    constraints: normalize(parsed.constraints),
    acceptance: normalize(parsed.acceptance),
    outOfScope: normalize(parsed.outOfScope),
    assumptions: normalize(parsed.assumptions),
  }
}

/* ------------------------------------------------------------------ *
 * 卡片交互
 * ------------------------------------------------------------------ */

async function requestInteraction(ctx, config, pendings, agent, signal, kind, data, diag) {
  const sessionId = idOf(agent)
  const claimWaitMs = clampInt(config.cardClaimWaitMs.get(), 200, 15000, 2500)
  const pending = { sessionId, kind, data, createdAt: Date.now(), claimed: false, resolve: undefined }
  pendings.set(sessionId, pending)
  const outcome = await new Promise((resolve) => {
    let settled = false
    let timeout
    const finish = (value) => {
      if (settled) return
      settled = true
      try {
        clearTimeout(timeout)
      } catch {}
      resolve(value)
    }
    pending.resolve = finish
    timeout = setTimeout(() => finish({ type: 'timeout' }), 180_000)
    if (signal !== undefined && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', () => finish({ type: 'aborted' }), { once: true })
    }
    setTimeout(() => {
      if (!pending.claimed) finish({ type: 'fallback' })
    }, claimWaitMs)
  })
  pendings.delete(sessionId)
  pending.resolve = undefined
  diag('interaction', { sessionId, kind, outcome: outcome?.type, claimed: pending.claimed === true })
  return outcome ?? { type: 'timeout' }
}

function serializePending(pending) {
  return {
    sessionId: pending.sessionId,
    kind: pending.kind,
    claimed: pending.claimed === true,
    createdAt: pending.createdAt,
    ...(pending.data ?? {}),
  }
}

/* ------------------------------------------------------------------ *
 * HTTP 路由
 * ------------------------------------------------------------------ */

async function handleRoute(ctx, config, pendings, sessions, req, res, diag) {
  try {
    if (!isLoopback(req)) return sendJson(res, 403, { error: 'loopback only' })
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.slice(ROUTE_PREFIX.length) || '/'

    if (req.method === 'GET' && path === '/pending') {
      const sessionId = url.searchParams.get('sessionId') ?? ''
      const pending = pendings.get(sessionId)
      if (!pending) return sendJson(res, 200, { ok: true, pending: null })
      pending.claimed = true
      return sendJson(res, 200, { ok: true, pending: serializePending(pending) })
    }
    if (req.method === 'POST' && path === '/decide') {
      const body = await readJsonBody(req)
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
      const pending = pendings.get(sessionId)
      if (!pending) return sendJson(res, 404, { ok: false, error: 'no pending interaction for this session' })
      diag('route', { path: '/decide', sessionId, kind: pending.kind, action: body?.action ?? null, value: body?.value ?? null })
      try {
        pending.resolve?.({ type: 'answer', action: body?.action, value: body?.value && typeof body.value === 'object' ? body.value : undefined })
      } catch {}
      return sendJson(res, 200, { ok: true })
    }
    // 一次性接管：读/写“下一次接管并自动恢复”的状态
    if (req.method === 'GET' && path === '/once') {
      return sendJson(res, 200, { ok: true, once: readOnce() })
    }
    if (req.method === 'POST' && path === '/once') {
      const body = await readJsonBody(req)
      if (body?.armed === true) {
        const fallback = typeof body?.fallback === 'string' && body.fallback !== 'once' ? body.fallback : 'vague'
        writeOnce({ armed: true, fallback })
        diag('route', { path: '/once', armed: true, fallback })
        return sendJson(res, 200, { ok: true, once: readOnce() })
      }
      writeOnce({ armed: false, fallback: readOnce().fallback })
      diag('route', { path: '/once', armed: false })
      return sendJson(res, 200, { ok: true, once: readOnce() })
    }
    if (req.method === 'GET' && path === '/session-prefs') {
      const sessionId = url.searchParams.get('sessionId') ?? ''
      if (!sessionId) return sendJson(res, 400, { ok: false, error: 'sessionId is required' })
      const entry = sessions.get(sessionId)
      return sendJson(res, 200, { ok: true, prefs: { skipClarify: entry.skipClarify, onceArmed: entry.onceArmed }, brief: entry.brief ?? null })
    }
    if (req.method === 'POST' && path === '/session-prefs') {
      const body = await readJsonBody(req)
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
      if (!sessionId) return sendJson(res, 400, { ok: false, error: 'sessionId is required' })
      const patch = {}
      if (typeof body?.skipClarify === 'boolean') patch.skipClarify = body.skipClarify
      if (typeof body?.onceArmed === 'boolean') patch.onceArmed = body.onceArmed
      const entry = sessions.set(sessionId, patch)
      diag('route', { path: '/session-prefs', sessionId, prefs: { skipClarify: entry.skipClarify, onceArmed: entry.onceArmed } })
      return sendJson(res, 200, { ok: true, prefs: { skipClarify: entry.skipClarify, onceArmed: entry.onceArmed } })
    }
    if (req.method === 'GET' && (path === '/state' || path === '/')) {
      const catalog = await getCatalog(ctx, undefined)
      const brain = await resolveBrain(ctx, config, catalog, undefined)
      return sendJson(res, 200, { ok: true, version: VERSION, brain: brain ?? null, config: readConfigSnapshot(config) })
    }
    if (req.method === 'GET' && path === '/models') {
      // 给客户端设置页提供"所有可用 provider/模型 + 各自推理档位"清单。
      const catalog = await getCatalog(ctx, undefined)
      const groups = catalog.map((group) => ({
        id: group.provider,
        label: group.label,
        models: group.models.map((model) => ({
          id: model.id,
          name: model.name,
          description: model.description,
          reasoning: {
            defaultEffort: model.defaultEffort,
            efforts: model.efforts.map((effort) => ({ id: effort.id, name: effort.name })),
          },
        })),
      }))
      return sendJson(res, 200, { ok: true, groups })
    }
    if (req.method === 'POST' && path === '/analyze') {
      const body = await readJsonBody(req)
      const text = typeof body?.text === 'string' ? body.text.slice(0, 20000) : ''
      if (!text.trim()) return sendJson(res, 400, { ok: false, error: 'text is required' })
      const analysis = await analyze(ctx, config, { text, diag })
      return sendJson(res, 200, { ok: true, analysis: analysis ?? null })
    }
    if (req.method === 'GET' && path === '/log') {
      const file = logPath()
      let size = 0
      try {
        size = (await stat(file)).size
      } catch {}
      let content = ''
      try {
        content = await readFile(file, 'utf8')
      } catch {}
      const limit = clampInt(Number(url.searchParams.get('lines') ?? 200), 1, 5000, 200)
      const lines = content.trim().split('\n').filter(Boolean)
      return sendJson(res, 200, { ok: true, file, size, lines: lines.slice(-limit) })
    }
    return sendJson(res, 404, { ok: false, error: `unknown route ${req.method} ${path}` })
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: errorText(error) })
  }
}

function readConfigSnapshot(config) {
  return {
    enabled: config.enabled.get(),
    triggerMode: config.triggerMode.get(),
    maxClarifyRounds: config.maxClarifyRounds.get(),
    watchTurns: config.watchTurns.get(),
    briefConfirm: config.briefConfirm.get(),
    brainProvider: config.brainProvider.get(),
    brainModel: config.brainModel.get(),
    brainEffort: config.brainEffort.get(),
  }
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function parseJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) return undefined
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    const value = JSON.parse(stripped.slice(start, end + 1))
    return value && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}
function isLoopback(req) {
  const address = req?.socket?.remoteAddress
  return address === undefined || address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}
function readJsonBody(req, limit = 65536) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        rejectPromise(new Error('request body too large'))
        try {
          req.destroy()
        } catch {}
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim()
        resolvePromise(text ? JSON.parse(text) : {})
      } catch (error) {
        rejectPromise(error)
      }
    })
    req.on('error', rejectPromise)
  })
}
function sendJson(res, status, value) {
  try {
    const body = JSON.stringify(value)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    res.end(body)
  } catch {
    try {
      res.destroy()
    } catch {}
  }
}
function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}
function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}
function idOf(agent) {
  try {
    return String(agent?.id ?? agent?.session?.id ?? '?')
  } catch {
    return '?'
  }
}
