/* global window, fetch */
/**
 * 提问引导 / dsh-HelpMe-To-Ask — 浏览器半侧（澄清卡 / 任务简报 / 快捷设置）。
 *
 * 1) conversation.input.dock：按宿主要求渲染「澄清卡」或「任务简报卡」
 * 2) conversation.input.left：输入框旁的「提问引导」开关 + 齿轮快捷设置
 * 3) settings.section：完整设置页
 */
window.__ModuleLoader__.load({
  id: 'dsh-help-me-to-ask',
  factory(require) {
    const React = require('react')
    // 尽量把弹层渲染到 body，绕开聊天区容器的 overflow/transform 裁切；拿不到 react-dom 时退回原地渲染。
    let ReactDOM
    try {
      ReactDOM = require('react-dom')
    } catch {
      ReactDOM = undefined
    }
    const h = React.createElement
    const NS = 'dsh-help-me-to-ask'
    const ROW_ID = 'dsh-help-me-to-ask'
    const API = '/dsh-help-me-to-ask'

    const DEFAULTS = {
      enabled: true,
      triggerMode: 'vague',
      maxClarifyRounds: 3,
      watchTurns: true,
      briefConfirm: true,
      brainProvider: '',
      brainModel: '',
      brainEffort: '',
    }

    const DICTIONARIES = {
      en: {
        nav: 'Ask Guide',
        title: 'Ask Guide',
        intro:
          'Before the first answer, when a request is vague, a strong reasoning model asks only for genuinely missing information and turns the answers into a short task sheet: what to do, what you get, how “done” is judged. The sheet is injected into the conversation, so the model knows exactly what to do. No model / reasoning routing.',
        basics: 'Basics',
        enabledLabel: 'Enable pre-answer clarification',
        trigger: 'When to clarify',
        triggerVague: 'Only when the request is vague',
        triggerVagueDesc: 'Ask first when goal / deliverable / constraints are missing (recommended).',
        triggerComplex: 'Also for complex tasks',
        triggerComplexDesc: 'Even a clear goal gets a quick detail check when the task looks complex.',
        triggerAlways: 'Every new session',
        triggerAlwaysDesc: 'Only on the first real work message of each session; greetings are ignored.',
        triggerOff: 'Off',
        triggerOffDesc: 'Never ask; behave like the native app.',
        triggerSessionSkip: 'Skip in this conversation',
        triggerSessionSkipDesc: 'No clarification here; other conversations keep their setting.',
        triggerOnce: 'Help me out once',
        triggerOnceDesc: 'Take over the next message in this conversation once, then return to the current mode automatically.',
        stateVague: 'Vague',
        stateComplex: 'Complex',
        stateAlways: 'Every chat',
        stateSkipped: 'Skipped here',
        stateOnce: 'Once',
        stateOff: 'Off',
        sectionBehavior: 'Follow-up behavior',
        triggerHint: 'Pick how proactive the clarification should be. Pure greetings are ignored; the plugin waits for real work intent.',
        foldAsk: 'When to ask',
        foldSession: 'This conversation',
        foldMore: 'More settings',
        foldBasic: 'Basics',
        foldBrain: 'Brain model (used for the plugin analysis)',
        moreRound: 'Max follow-up rounds',
        moreBriefConfirm: 'Review the task sheet before starting',
        moreBriefConfirmHint: 'A short sheet: what to do, what you get, how it is judged done.',
        rounds: 'Max clarification rounds',
        roundsHint: 'Max follow-up rounds, 1–10 (default 3). The plugin stops early when no new information is left; after round 3 only new, outcome-changing gaps are asked — the rest is left to the model.',
        watchTurns: 'Offer brief updates when the goal shifts',
        watchTurnsHint: 'Only reacts to explicit change phrases (换个/改成/重新…) in later messages.',
        briefConfirm: 'Review the task sheet before starting',
        briefConfirmHint:
          'Before the model starts, show you a short sheet: what will be done, what you will get, and how “done” is judged. Nothing runs until you confirm it. You can also choose “Modify” or “Skip”.',
        advanced: 'Brain model (plugin analysis)',
        brainHint: 'Default always picks the newest DeepSeek model with Max. Models from other providers are read automatically too; your pick overrides Auto.',
        brainProvider: 'Provider',
        brainModel: 'Model',
        brainEffort: 'Reasoning effort',
        brainModelLabel: 'Brain model (read from the client model catalog)',
        brainAuto: 'Auto (newest DeepSeek + Max)',
        brainEffortAuto: 'Auto (highest level)',
        brainCatalogFail: 'Could not read the client model catalog; staying on Auto.',
        brainCatalogLoading: 'Loading available models…',
        loading: 'Loading settings…',
        unavailable: 'This page cannot reach the plugin config.',
        saved: 'Saved',
        saving: 'Saving…',
        saveFailed: 'Save failed — retry.',
        reset: 'Reset to defaults',
        // clarify card
        clarifyTitle: 'Align on the goal',
        understood: 'My understanding',
        goalLabel: 'Goal',
        deliverableLabel: 'Deliverable',
        constraintsLabel: 'Scope / constraints (multi)',
        acceptanceLabel: 'Acceptance criteria (multi)',
        contextLabel: 'Your notes',
        yesNoLabel: 'A few quick questions',
        contextPlaceholder: 'Anything else the model should know…',
        customGoalPlaceholder: 'Or type your goal directly…',
        autoBrief: 'One-click brief',
        makeBrief: 'Create brief',
        skip: 'Skip',
        roundTag: 'round',
        // brief card
        briefTitle: 'Task sheet',
        briefSummary: 'In one line',
        briefIntro:
          'This sheet is built from your answers. Check it, then the model will follow it exactly. If something looks off, choose “Modify”.',
        goal: 'What to make',
        deliverable: 'What you get',
        constraints: 'Limits (what I may touch / use)',
        acceptance: 'How we know it is done',
        outOfScope: 'Not touching',
        assumptions: 'Guesses (fill gaps)',
        confirmStart: 'Confirm & start',
        editBrief: 'Modify',
        // quick
        quickLabel: 'Ask',
        quickOn: 'On',
        quickOff: 'Off',
        quickSkip: 'Skipped here',
        quickTitle: 'Ask Guide',
        quickHint: 'Full settings: Settings → Ask Guide',
        sessionSection: 'This conversation',
        sessionSkip: 'Skip clarification here',
        sessionSkipHint: 'Only this conversation is skipped.',
      },
      zh: {
        nav: '提问引导',
        title: '提问引导',
        intro:
          '生成前如果需求宽泛，用最强的模型只问真正缺失的信息，再把回答整理成一张「任务说明」小单子（要做什么、最后给你什么、怎样算做好），确认后注入会话，让模型确切知道要做什么。不再做模型/推理路由。',
        basics: '基础设置',
        enabledLabel: '启用生成前提问引导',
        trigger: '什么时候提问',
        triggerVague: '只在需求模糊时问',
        triggerVagueDesc: '缺目标 / 交付物 / 限制时，先问清楚再生成（推荐）',
        triggerComplex: '复杂任务也问',
        triggerComplexDesc: '任务看起来复杂时，即使目标清楚也先确认关键细节',
        triggerAlways: '每个新会话都问',
        triggerAlwaysDesc: '只在每个新会话的第一段工作内容上触发，寒暄不触发',
        triggerOff: '关闭',
        triggerOffDesc: '不主动提问，和原生行为一致',
        triggerSessionSkip: '本会话跳过',
        triggerSessionSkipDesc: '这个对话里不再引导；其他会话仍按各自设置',
        triggerOnce: '帮我一下',
        triggerOnceDesc: '当前会话的下一条消息直接接管一次，用完自动恢复当前模式',
        stateVague: '模糊时',
        stateComplex: '复杂时',
        stateAlways: '每次',
        stateSkipped: '跳过',
        stateOnce: '一次性',
        stateOff: '关',
        sectionBehavior: '追问行为',
        triggerHint: '选择提问的主动程度；纯寒暄不会触发，等出现工作意图再问。',
        foldAsk: '提问时机',
        foldSession: '本会话',
        foldMore: '更多设置',
        foldBasic: '基础设置',
        foldBrain: '大脑模型（插件自身分析用）',
        moreRound: '最多追问轮数',
        moreBriefConfirm: '开始前先看任务说明',
        moreBriefConfirmHint: '一张小单子：做什么、给你什么、怎样算做好。',
        rounds: '最多追问轮数',
        roundsHint: '最多追问几轮，1–10（默认 3）。没有新信息可问时会自动提前停止；第 3 轮后只问会显著改变产出的新关键点，其余细节交给模型边做边问。',
        watchTurns: '后续目标变化时提示更新简报',
        watchTurnsHint: '只对明确改口（换个/改成/重新…）做出反应。',
        briefConfirm: '开始前先确认任务说明',
        briefConfirmHint:
          '生成前先把“要做什么、最后给你什么、怎样算做好”列成一张小单子，让你看一眼；你点确认之后它才开始干活，不满意可以点“改一改”。',
        advanced: '大脑模型（插件自身分析用）',
        brainHint: '默认永远选 DeepSeek 最新一代 + Max；其他厂商的模型也会自动读取，手动选择优先于自动。',
        brainProvider: 'Provider',
        brainModel: '模型',
        brainEffort: '推理等级',
        brainModelLabel: '大脑模型（自动读取客户端可用模型）',
        brainAuto: '自动（最新 DeepSeek + Max）',
        brainEffortAuto: '自动（该模型最高档）',
        brainCatalogFail: '读取客户端模型目录失败，暂用自动模式。',
        brainCatalogLoading: '正在读取可用模型…',
        loading: '正在读取设置…',
        unavailable: '当前页面读不到插件配置。',
        saved: '已保存',
        saving: '保存中…',
        saveFailed: '保存失败，请重试。',
        reset: '恢复默认值',
        clarifyTitle: '先对齐目标',
        understood: '我的理解',
        goalLabel: '目标',
        deliverableLabel: '交付物',
        constraintsLabel: '范围 / 限制（多选）',
        acceptanceLabel: '验收标准（多选）',
        contextLabel: '个人想法',
        yesNoLabel: '还有几个问题',
        contextPlaceholder: '还有什么模型应该知道的，写在这里…',
        customGoalPlaceholder: '或者直接写你的目标…',
        autoBrief: '一键明确目标',
        makeBrief: '生成任务简报',
        skip: '跳过',
        roundTag: '第',
        briefTitle: '任务说明',
        briefSummary: '一句话概括',
        briefIntro:
          '这张小单子是照着你的回答整理的；确认之后，模型会按它来做。哪里不对就点“改一改”。',
        goal: '要做成什么',
        deliverable: '最后给你什么',
        constraints: '限制（能改哪些、用什么）',
        acceptance: '怎样算做好',
        outOfScope: '明确不碰的',
        assumptions: '没问到、先这样定',
        confirmStart: '确认并开始',
        editBrief: '改一改',
        quickLabel: '提问引导',
        quickOn: '开',
        quickOff: '关闭',
        quickSkip: '本会话跳过',
        quickTitle: '提问引导',
        quickHint: '完整设置：设置 → 提问引导',
        sessionSection: '本会话设置',
        sessionSkip: '本会话跳过目标引导',
        sessionSkipHint: '只影响当前会话。',
      },
    }

    const tokens = {
      text: 'var(--dsw-alias-label-primary, currentColor)',
      secondary: 'var(--dsw-alias-label-secondary, currentColor)',
      caption: 'var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary, currentColor))',
      tertiary: 'var(--dsw-alias-label-tertiary, currentColor)',
      border: 'var(--dsw-alias-border-l2, var(--dsw-alias-border-l3, rgba(127,127,127,.35)))',
      borderStrong: 'var(--dsw-alias-border-l3, rgba(127,127,127,.45))',
      hover: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12))',
      cardFill: 'var(--dsw-alias-settings-card-fill, var(--dsw-alias-interactive-bg-secondary, transparent))',
      cardStroke: 'var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l1, transparent))',
      accent: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
      success: 'var(--dsw-alias-state-success-primary, #2ea043)',
      error: 'var(--dsw-alias-state-error-primary, #e5534b)',
      radiusMd: 'var(--dsw-radius-md, 8px)',
      radiusLg: 'var(--dsw-radius-xl, 12px)',
      shadow: 'var(--dsw-elevation-prominent, 0 8px 24px rgba(0,0,0,.35))',
    }

    function parseCssColor(value) {
      if (typeof value !== 'string') return undefined
      const text = value.trim()
      let match = /^#([0-9a-f]{3,8})$/i.exec(text)
      if (match !== null) {
        let hex = match[1]
        if (hex.length === 3 || hex.length === 4) {
          hex = hex
            .slice(0, 3)
            .split('')
            .map((part) => part + part)
            .join('')
        }
        if (hex.length < 6) return undefined
        return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
      }
      match = /^rgba?\(([^)]+)\)$/i.exec(text)
      if (match !== null) {
        const parts = match[1].split(/[,/\s]+/).filter(Boolean).map(Number)
        if (parts.length >= 3 && parts.slice(0, 3).every((part) => Number.isFinite(part))) {
          return { r: parts[0], g: parts[1], b: parts[2] }
        }
      }
      return undefined
    }
    function resolveCssColor(value, fallback) {
      if (typeof value !== 'string') return fallback
      const text = value.trim()
      const varMatch = /^var\(\s*(--[\w-]+)/.exec(text)
      if (varMatch === null) return text
      try {
        const root = document.documentElement
        let raw = getComputedStyle(root).getPropertyValue(varMatch[1]).trim()
        if (!raw && document.body) raw = getComputedStyle(document.body).getPropertyValue(varMatch[1]).trim()
        if (raw) return raw
      } catch {}
      return fallback
    }
    function readableTextOn(backgroundValue, fallbackColor) {
      const rgb = parseCssColor(resolveCssColor(backgroundValue, ''))
      if (rgb === undefined) return fallbackColor
      const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
      return luminance > 0.62 ? '#111111' : '#ffffff'
    }

    /**
     * 桌面端标题栏（菜单 + 最小化/全屏/关闭按钮）会盖住 fixed 弹层。
     * 通过 Electron 拖拽区（-webkit-app-region: drag）测量它占的高度；量不到就退回一个保守值。
     */
    function measureTitlebarBottom() {
      let bottom = 0
      try {
        const viewportWidth = document.documentElement?.clientWidth ?? window.innerWidth
        const nodes = document.querySelectorAll('body *')
        for (let index = 0; index < nodes.length; index += 1) {
          const node = nodes[index]
          const rect = node.getBoundingClientRect()
          if (rect.bottom <= 0 || rect.top > 120) continue
          if (rect.width < viewportWidth * 0.55) continue
          const style = window.getComputedStyle(node)
          const region = (
            style.getPropertyValue('-webkit-app-region') ||
            style.getPropertyValue('app-region') ||
            ''
          ).trim()
          const isHeader = node.tagName === 'HEADER'
          const topBarLike = rect.top <= 8 && rect.bottom < 160 && rect.width >= viewportWidth * 0.55
          if (region === 'drag' || region === 'no-drag' || isHeader || topBarLike) {
            bottom = Math.max(bottom, rect.bottom)
          }
        }
      } catch {}
      if (bottom > 0) return bottom
      // 桌面端常见标题栏高度；宁可比实际高一点，也不要被窗口按钮盖住。
      return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent) ? 64 : 0
    }

    const STYLE = [
      '.dshpf-chip{transition:background .12s ease,border-color .12s ease}',
      '.dshpf-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12))}',
      '.dshpf-pop{animation:dshpf-pop-in .14s ease both}',
      '@keyframes dshpf-pop-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}',
      '@media (max-width: 620px){.dshpf-card{padding:12px 12px !important;gap:10px !important}}',
    ].join('\n')

    const styles = {
      page: { maxWidth: 720, color: tokens.text, display: 'flex', flexDirection: 'column', gap: 12 },
      title: { margin: 0, fontSize: 16, fontWeight: 500, lineHeight: '24px' },
      intro: { margin: 0, fontSize: 14, lineHeight: '22px', color: tokens.tertiary },
      sectionTitle: { margin: '10px 0 0', fontSize: 13, fontWeight: 500, lineHeight: '20px', color: tokens.secondary },
      card: {
        border: '0.5px solid ' + tokens.cardStroke,
        background: tokens.cardFill,
        borderRadius: tokens.radiusLg,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      },
      row: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' },
      rowText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 160px' },
      label: { fontSize: 14, lineHeight: '22px', fontWeight: 400 },
      hint: { fontSize: 12, lineHeight: '18px', color: tokens.caption },
      control: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' },
      input: {
        boxSizing: 'border-box',
        height: 32,
        padding: '0 8px',
        borderRadius: tokens.radiusMd,
        border: '0.5px solid ' + tokens.border,
        background: 'transparent',
        color: tokens.text,
        font: 'inherit',
        fontSize: 13,
        minWidth: 0,
      },
      status: (kind) => ({
        fontSize: 12,
        lineHeight: '18px',
        color: kind === 'ok' ? tokens.success : kind === 'error' ? tokens.error : tokens.tertiary,
      }),
      resetButton: {
        alignSelf: 'flex-start',
        marginTop: 4,
        height: 30,
        padding: '0 12px',
        borderRadius: tokens.radiusMd,
        border: '0.5px solid ' + tokens.borderStrong,
        background: 'transparent',
        color: tokens.secondary,
        font: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
      },
    }

    function knobStyle(on) {
      return {
        position: 'absolute',
        top: 3,
        left: on ? 21 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#ffffff',
        transition: 'left .12s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,.35)',
      }
    }
    function switchStyle(on, disabled) {
      return {
        position: 'relative',
        width: 40,
        height: 22,
        padding: 0,
        border: 'none',
        borderRadius: 11,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: on ? tokens.accent : tokens.borderStrong,
        transition: 'background .12s ease',
        flexShrink: 0,
      }
    }
    function Toggle({ checked, disabled, onChange }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': checked ? 'true' : 'false',
          disabled: disabled === true,
          onClick: () => onChange(!checked),
          style: switchStyle(checked, disabled === true),
        },
        h('span', { style: knobStyle(checked) }),
      )
    }
    function Row({ label, hint, children }) {
      return h(
        'div',
        { style: styles.row },
        h(
          'div',
          { style: styles.rowText },
          h('div', { style: styles.label }, label),
          hint ? h('div', { style: styles.hint }, hint) : null,
        ),
        children ? h('div', { style: styles.control }, children) : null,
      )
    }
    function TextField({ value, placeholder, width = 220, disabled, onCommit }) {
      const [draft, setDraft] = React.useState(value ?? '')
      React.useEffect(() => {
        setDraft(value ?? '')
      }, [value])
      return h('input', {
        type: 'text',
        value: draft,
        placeholder: placeholder ?? '',
        spellCheck: false,
        disabled: disabled === true,
        style: { ...styles.input, width },
        onChange: (event) => setDraft(event.target.value),
        onBlur: () => {
          if (draft !== (value ?? '')) onCommit(draft.trim())
        },
        onKeyDown: (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        },
      })
    }
    function Segmented({ value, options, disabled, onChange }) {
      const onAccent = readableTextOn(tokens.accent, '#ffffff')
      return h(
        'div',
        {
          style: {
            display: 'inline-flex',
            padding: 2,
            gap: 2,
            borderRadius: tokens.radiusMd,
            border: '0.5px solid ' + tokens.border,
            flexWrap: 'wrap',
          },
        },
        options.map((option) =>
          h(
            'button',
            {
              key: option.value,
              type: 'button',
              className: 'dshpf-chip',
              disabled: disabled === true,
              onClick: () => onChange(option.value),
              style: {
                height: 24,
                padding: '0 10px',
                border: 'none',
                borderRadius: 'calc(' + tokens.radiusMd + ' - 2px)',
                cursor: disabled ? 'default' : 'pointer',
                font: 'inherit',
                fontSize: 12,
                background: value === option.value ? tokens.accent : 'transparent',
                color: value === option.value ? onAccent : tokens.text,
                fontWeight: value === option.value ? 500 : 400,
              },
            },
            option.label,
          ),
        ),
      )
    }
    function Chip({ label, active, onClick }) {
      const onAccent = readableTextOn(tokens.accent, '#ffffff')
      return h(
        'button',
        {
          type: 'button',
          className: 'dshpf-chip',
          onClick,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            height: 28,
            padding: '0 10px',
            borderRadius: tokens.radiusMd,
            border: '0.5px solid ' + (active ? tokens.accent : tokens.border),
            background: active ? tokens.accent : 'transparent',
            color: active ? onAccent : tokens.text,
            font: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
          },
        },
        label,
      )
    }
    function buttonStyle(kind) {
      const onAccent = readableTextOn(tokens.accent, '#ffffff')
      if (kind === 'primary') {
        return {
          height: 30,
          padding: '0 14px',
          border: 'none',
          borderRadius: tokens.radiusMd,
          background: tokens.accent,
          color: onAccent,
          font: 'inherit',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }
      }
      if (kind === 'secondary') {
        return {
          height: 30,
          padding: '0 12px',
          border: '0.5px solid ' + tokens.borderStrong,
          borderRadius: tokens.radiusMd,
          background: 'transparent',
          color: tokens.secondary,
          font: 'inherit',
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }
      }
      return {
        height: 30,
        padding: '0 8px',
        border: 'none',
        borderRadius: tokens.radiusMd,
        background: 'transparent',
        color: tokens.tertiary,
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }
    }

    function useSnapshot(scope) {
      const [state, setState] = React.useState(() => {
        try {
          return scope?.getSnapshot?.()
        } catch {
          return undefined
        }
      })
      React.useEffect(() => {
        if (!scope || typeof scope.subscribe !== 'function') return undefined
        let alive = true
        const update = () => {
          if (!alive) return
          try {
            setState(scope.getSnapshot())
          } catch {}
        }
        update()
        let dispose
        try {
          dispose = scope.subscribe(update)
        } catch {}
        return () => {
          alive = false
          try {
            dispose?.()
          } catch {}
        }
      }, [scope])
      return state
    }
    function useScopeValues(scope) {
      const state = useSnapshot(scope)
      const snapshot = state ?? {}
      const source = snapshot.value ?? snapshot.base ?? {}
      return { snapshot, valueOf: (key) => (source?.[key] === undefined ? DEFAULTS[key] : source[key]) }
    }

    /** 可折叠分区（用于快捷面板与设置页整理视觉）。 */
    function Fold({ title, hint, open, onToggle, children }) {
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h(
          'button',
          {
            type: 'button',
            onClick: onToggle,
            'aria-expanded': open ? 'true' : 'false',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: 0,
              border: 'none',
              background: 'transparent',
              color: tokens.secondary,
              font: 'inherit',
              fontSize: 12,
              cursor: 'pointer',
              textAlign: 'left',
            },
          },
          h(
            'span',
            {
              style: {
                display: 'inline-block',
                transition: 'transform .12s ease',
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                color: tokens.caption,
              },
            },
            '\u25B8',
          ),
          h('span', { style: { fontWeight: 500 } }, title),
          hint ? h('span', { style: { color: tokens.caption, fontWeight: 400 } }, hint) : null,
        ),
        open ? children : null,
      )
    }

    /** 提问时机选择：每个选项都带一句人话解释；「一次性接管」用金色区分，并和其他模式互斥。 */
    function TriggerPicker({
      t,
      value,
      disabled,
      onChange,
      compact,
      sessionSkipped,
      onSelectSession,
      onceArmed,
      onSelectOnce,
    }) {
      const options = [
        { id: 'vague', label: t('triggerVague'), desc: t('triggerVagueDesc') },
        { id: 'complex', label: t('triggerComplex'), desc: t('triggerComplexDesc') },
        { id: 'always', label: t('triggerAlways'), desc: t('triggerAlwaysDesc') },
      ]
      if (typeof onSelectSession === 'function') {
        options.push({ id: '__session_skip__', label: t('triggerSessionSkip'), desc: t('triggerSessionSkipDesc') })
      }
      if (typeof onSelectOnce === 'function') {
        options.push({
          id: '__once__',
          label: t('triggerOnce'),
          desc: t('triggerOnceDesc'),
          accent: true,
        })
      }
      const onceAccent = 'var(--dsw-alias-state-warn-primary, #d4a13d)'
      const armed = onceArmed === true
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        options.map((option) => {
          const sessionOption = option.id === '__session_skip__'
          const onceOption = option.id === '__once__'
          const active = onceOption
            ? armed
            : sessionOption
              ? !armed && sessionSkipped === true
              : !armed && sessionSkipped !== true && value === option.id
          const accentColor = option.accent ? onceAccent : tokens.accent
          return h(
            'button',
            {
              key: option.id,
              type: 'button',
              disabled: disabled === true,
              onClick: () => {
                if (onceOption) {
                  if (typeof onSelectOnce === 'function') onSelectOnce(true)
                  return
                }
                if (sessionOption) {
                  if (typeof onSelectSession === 'function') onSelectSession(true)
                  return
                }
                if (typeof onSelectOnce === 'function') onSelectOnce(false)
                if (typeof onSelectSession === 'function') onSelectSession(false)
                onChange(option.id)
              },
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                textAlign: 'left',
                padding: '7px 9px',
                borderRadius: tokens.radiusMd,
                border:
                  '0.5px solid ' +
                  (active
                    ? accentColor
                    : option.accent
                      ? 'color-mix(in srgb, ' + onceAccent + ' 45%, ' + tokens.border + ')'
                      : tokens.border),
                background: active
                  ? option.accent
                    ? 'color-mix(in srgb, ' + onceAccent + ' 14%, transparent)'
                    : tokens.hover
                  : 'transparent',
                color: tokens.text,
                font: 'inherit',
                cursor: disabled === true ? 'default' : 'pointer',
                opacity: disabled === true ? 0.6 : 1,
              },
            },
            h(
              'span',
              {
                style: {
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '1.5px solid ' + (active ? accentColor : tokens.borderStrong),
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                },
              },
              active ? h('span', { style: { width: 6, height: 6, borderRadius: '50%', background: accentColor } }) : null,
            ),
            h(
              'span',
              { style: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 } },
              h(
                'span',
                { style: { fontSize: 13, fontWeight: active ? 500 : 400, lineHeight: '18px', color: option.accent ? onceAccent : tokens.text } },
                option.label,
              ),
              compact === true
                ? null
                : h('span', { style: { fontSize: 11, lineHeight: '16px', color: tokens.caption } }, option.desc),
            ),
          )
        }),
      )
    }

    /* ---------------- 澄清卡 / 简报卡 ---------------- */

    function PendingCard(props) {
      const { sessionId, t } = props
      const [pending, setPending] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [goal, setGoal] = React.useState('')
      const [deliverable, setDeliverable] = React.useState('')
      const [constraints, setConstraints] = React.useState([])
      const [acceptance, setAcceptance] = React.useState([])
      const [yesNo, setYesNo] = React.useState({})
      const [custom, setCustom] = React.useState('')

      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        let timer
        const tick = async () => {
          try {
            const response = await fetch(API + '/pending?sessionId=' + encodeURIComponent(sessionId), { cache: 'no-store' })
            if (response.ok) {
              const data = await response.json()
              if (alive) setPending(data?.pending ?? null)
            }
          } catch {}
          if (alive) timer = setTimeout(tick, 900)
        }
        tick()
        return () => {
          alive = false
          if (timer !== undefined) clearTimeout(timer)
        }
      }, [sessionId])

      const key = pending === null ? '' : String(pending.createdAt ?? '') + ':' + String(pending.kind ?? '')
      React.useEffect(() => {
        setGoal('')
        setDeliverable('')
        setConstraints([])
        setAcceptance([])
        setYesNo({})
        setCustom('')
      }, [key])

      const decide = async (payload) => {
        if (busy) return
        setBusy(true)
        setPending(null)
        try {
          await fetch(API + '/decide', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId, ...payload }),
          })
        } catch {}
        setBusy(false)
      }

      if (!pending) return null

      // 外观对齐 DSH 原生问答卡：卡片自带标题、描述、选项行与底部操作。
      const PLUGIN_EYEBROW = '提问引导 · dsh-HelpMe-To-Ask'
      const cardStyle = {
        width: '100%',
        maxWidth: 'var(--dsh-chat-content-width, 760px)',
        margin: '0 auto',
        alignSelf: 'center',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: 'min(60vh, 520px)',
        borderRadius: 'var(--dsw-radius-xl, 16px)',
        background: 'var(--dsw-specific-input-major, ' + tokens.cardFill + ')',
        boxShadow: 'var(--dsw-elevation-panel, 0 10px 30px rgba(0,0,0,.28))',
        border: '0.5px solid ' + tokens.cardStroke,
        color: 'var(--dsw-alias-label-primary, ' + tokens.text + ')',
      }
      const headerStyle = {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '18px 16px 0 22px',
      }
      const eyebrowStyle = {
        fontSize: 11,
        lineHeight: '16px',
        color: 'var(--dsw-alias-label-tertiary, ' + tokens.caption + ')',
        letterSpacing: '.01em',
        marginBottom: 5,
      }
      const titleStyle = { margin: 0, fontSize: 16, fontWeight: 500, lineHeight: '22px' }
      const descStyle = {
        margin: '6px 0 0',
        fontSize: 13,
        lineHeight: '20px',
        color: 'var(--dsw-alias-label-tertiary, ' + tokens.caption + ')',
      }
      const bodyStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        padding: '12px 22px 6px',
      }
      const footerStyle = {
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px 12px 22px',
        borderTop: '0.5px solid ' + tokens.border,
      }
      const sectionTitleStyle = { fontSize: 14, fontWeight: 500, lineHeight: '22px' }
      const optionStyle = (active) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
        minHeight: 38,
        padding: '8px 12px 8px 8px',
        borderRadius: 'var(--dsw-radius-md, 8px)',
        border: '1px solid ' + (active ? tokens.borderStrong : 'transparent'),
        background: active ? tokens.hover : 'transparent',
        color: tokens.text,
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background .12s ease, border-color .12s ease',
        flexShrink: 0,
        boxSizing: 'border-box',
      })
      const indicatorStyle = (active, multi) => ({
        width: 18,
        height: 18,
        borderRadius: multi ? 'var(--dsw-radius-xs, 5px)' : '50%',
        border: '1.5px solid ' + (active ? tokens.accent : tokens.borderStrong),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      })
      const checkStyle = (active, multi) => ({
        width: multi ? 8 : 7,
        height: multi ? 8 : 7,
        borderRadius: multi ? 2 : '50%',
        background: active ? tokens.accent : 'transparent',
        display: 'inline-block',
      })
      const optionRow = (label, active, multi, onClick) =>
        h(
          'button',
          { key: label, type: 'button', onClick, style: optionStyle(active) },
          h('span', { style: indicatorStyle(active, multi) }, active ? h('span', { style: checkStyle(active, multi) }) : null),
          h(
            'span',
            { style: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: '22px', fontWeight: active ? 500 : 400 } },
            label,
          ),
        )
      const section = (label, children) =>
        h(
          'section',
          { key: label, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          h('div', { style: sectionTitleStyle }, label),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } }, children),
        )
      const header = (title, extra) =>
        h(
          'div',
          { style: headerStyle },
          h(
            'div',
            { style: { minWidth: 0 } },
            h('div', { style: eyebrowStyle }, PLUGIN_EYEBROW),
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' } }, h('h2', { style: titleStyle }, title), extra ?? null),
          ),
          h(
            'button',
            {
              type: 'button',
              style: { ...buttonStyle('tertiary'), flexShrink: 0 },
              disabled: busy,
              onClick: () => decide(pending.kind === 'brief' ? { action: 'keep' } : { value: { skip: true } }),
            },
            t('skip'),
          ),
        )

      if (pending.kind === 'brief') {
        const brief = pending.brief ?? {}
        const rows = [
          [t('goal'), brief.goal],
          [t('deliverable'), brief.deliverable],
          [t('constraints'), (brief.constraints ?? []).join('；')],
          [t('acceptance'), (brief.acceptance ?? []).join('；')],
          [t('outOfScope'), (brief.outOfScope ?? []).join('；')],
          [t('assumptions'), (brief.assumptions ?? []).join('；')],
        ].filter(([, value]) => typeof value === 'string' && value.trim() !== '')
        return h(
          'div',
          { className: 'dshpf-pop', style: cardStyle },
          h('style', null, STYLE),
          header(
            pending.mode === 'drift' ? t('briefTitle') + ' · ' + t('briefSummary') : t('briefTitle'),
            typeof pending.round === 'number' ? h('span', { style: { fontSize: 12, color: tokens.caption } }, t('roundTag') + ' ' + (pending.round + 1)) : null,
          ),
          h(
            'div',
            { style: bodyStyle },
            h('p', { style: { ...descStyle, margin: 0 } }, pending.mode === 'drift' ? t('briefIntro') : brief.summary || t('briefIntro')),
            h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 1, border: '0.5px solid ' + tokens.border, borderRadius: 'var(--dsw-radius-lg, 12px)', background: 'var(--dsw-alias-bg-module-platform, transparent)', padding: 4 } },
              ...rows.map(([label, value]) =>
                h(
                  'div',
                  { key: label, style: { display: 'flex', flexDirection: 'column', gap: 1, padding: '7px 10px' } },
                  h('span', { style: { fontSize: 12, lineHeight: '16px', color: tokens.caption } }, label),
                  h('span', { style: { fontSize: 14, lineHeight: '22px', color: tokens.text } }, value),
                ),
              ),
            ),
          ),
          h(
            'div',
            { style: footerStyle },
            h('button', { type: 'button', style: buttonStyle('secondary'), disabled: busy, onClick: () => decide({ action: 'edit' }) }, t('editBrief')),
            h('button', { type: 'button', style: buttonStyle('primary'), disabled: busy, onClick: () => decide({ action: 'apply' }) }, t('confirmStart')),
          ),
        )
      }

      // clarify
      const analysis = pending.analysis ?? {}
      const toggleIn = (list, setList, item) => {
        setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
      }
      const goalRows = (analysis.goalOptions ?? []).map((item) =>
        optionRow(item, goal === item, false, () => setGoal(goal === item ? '' : item)),
      )
      const deliverableRows = (analysis.deliverableOptions ?? []).map((item) =>
        optionRow(item, deliverable === item, false, () => setDeliverable(deliverable === item ? '' : item)),
      )
      const constraintRows = (analysis.constraintOptions ?? []).map((item) =>
        optionRow(item, constraints.includes(item), true, () => toggleIn(constraints, setConstraints, item)),
      )
      const acceptanceRows = (analysis.acceptanceOptions ?? []).map((item) =>
        optionRow(item, acceptance.includes(item), true, () => toggleIn(acceptance, setAcceptance, item)),
      )
      const yesNoRows = (analysis.yesNo ?? []).map((item) =>
        h(
          'div',
          { key: item.id, style: { ...optionStyle(false), cursor: 'default' } },
          h(
            'span',
            { style: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: '22px' } },
            item.question,
          ),
          h(Toggle, {
            checked: yesNo[item.id] === undefined ? item.default !== false : yesNo[item.id] === true,
            onChange: (next) => setYesNo({ ...yesNo, [item.id]: next }),
          }),
        ),
      )

      return h(
        'div',
        { className: 'dshpf-pop', style: cardStyle },
        h('style', null, STYLE),
        header(
          t('clarifyTitle'),
          typeof pending.round === 'number' ? h('span', { style: { fontSize: 12, color: tokens.caption } }, t('roundTag') + ' ' + (pending.round + 1)) : null,
        ),
        h(
          'div',
          { style: bodyStyle },
          analysis.understanding
            ? h(
                'p',
                { style: { ...descStyle, margin: 0 } },
                h('span', { style: { color: tokens.caption } }, t('understood') + '：'),
                h('span', { style: { color: tokens.text } }, analysis.understanding),
              )
            : null,
          goalRows.length ? section(t('goalLabel'), goalRows) : null,
          h(
            'div',
            { style: { ...optionStyle(false), cursor: 'text' } },
            h('span', { style: indicatorStyle(false, false) }),
            h('input', {
              type: 'text',
              value: custom,
              placeholder: t('customGoalPlaceholder'),
              style: {
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: tokens.text,
                font: 'inherit',
                fontSize: 14,
                lineHeight: '22px',
                padding: 0,
              },
              onChange: (event) => {
                setCustom(event.target.value)
                if (event.target.value.trim() !== '') setGoal('')
              },
            }),
          ),
          deliverableRows.length ? section(t('deliverableLabel'), deliverableRows) : null,
          constraintRows.length ? section(t('constraintsLabel'), constraintRows) : null,
          acceptanceRows.length ? section(t('acceptanceLabel'), acceptanceRows) : null,
          yesNoRows.length
            ? h(
                'section',
                { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                h('div', { style: sectionTitleStyle }, t('yesNoLabel')),
                h('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } }, yesNoRows),
              )
            : null,
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: sectionTitleStyle }, t('contextLabel')),
            h('textarea', {
              value: custom,
              rows: 2,
              placeholder: t('contextPlaceholder'),
              style: {
                boxSizing: 'border-box',
                width: '100%',
                minHeight: 64,
                padding: '8px 12px',
                borderRadius: 'var(--dsw-radius-lg, 12px)',
                border: '0.5px solid ' + tokens.borderStrong,
                background: 'var(--dsw-alias-bg-module-platform, transparent)',
                color: tokens.text,
                font: 'inherit',
                fontSize: 14,
                lineHeight: '22px',
                resize: 'vertical',
                outline: 'none',
              },
              onChange: (event) => setCustom(event.target.value),
            }),
          ),
        ),
        h(
          'div',
          { style: footerStyle },
          h('button', { type: 'button', style: buttonStyle('secondary'), disabled: busy, onClick: () => decide({ value: { autoBrief: true } }) }, t('autoBrief')),
          h(
            'button',
            {
              type: 'button',
              style: buttonStyle('primary'),
              disabled: busy,
              onClick: () =>
                decide({
                  value: {
                    goal: custom.trim() || goal,
                    deliverable,
                    constraints,
                    acceptance,
                    yesNo,
                    custom: custom.trim(),
                  },
                }),
            },
            t('makeBrief'),
          ),
        ),
      )
    }

    /* ---------------- 输入框快捷控制 ---------------- */

    function GearIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': true, style: { display: 'block' } },
        h('path', {
          fill: 'currentColor',
          d: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9.3 4c0-.5-.04-.9-.11-1.35l2.02-1.58-2-3.46-2.38.96a7.9 7.9 0 0 0-2.34-1.35L16.1 2.5h-4l-.39 2.72a7.9 7.9 0 0 0-2.34 1.35l-2.38-.96-2 3.46 2.02 1.58a8.5 8.5 0 0 0 0 2.7L5 14.93l2 3.46 2.38-.96a7.9 7.9 0 0 0 2.34 1.35l.39 2.72h4l.39-2.72a7.9 7.9 0 0 0 2.34-1.35l2.38.96 2-3.46-2.02-1.58c.07-.45.11-.9.11-1.35Z',
        }),
      )
    }

    function QuickControls(props) {
      const { t, scope, sessionId } = props
      const [open, setOpen] = React.useState(false)
      const [sessionPrefs, setSessionPrefs] = React.useState(null)
      // 面板用 fixed 定位，避开聊天区祖先容器的 overflow 裁切；窗口矮时自动向下弹并按剩余空间限高。
      const [popoverStyle, setPopoverStyle] = React.useState(null)
      const rootRef = React.useRef(null)
      const popoverRef = React.useRef(null)
      const { snapshot, valueOf } = useScopeValues(scope)
      const enabled = valueOf('enabled') === true
      const trigger = valueOf('triggerMode')
      const writable = snapshot?.writable !== false
      const skipped = sessionPrefs?.skipClarify === true
      // 聊天框里的状态简写：直接显示当前提问时机，而不是笼统的"开"
      const stateText = !enabled
        ? t('stateOff')
        : sessionPrefs?.onceArmed === true
          ? t('stateOnce')
          : skipped
            ? t('stateSkipped')
            : trigger === 'off'
              ? t('stateOff')
              : trigger === 'always'
                ? t('stateAlways')
                : trigger === 'complex'
                  ? t('stateComplex')
                  : t('stateVague')

      React.useEffect(() => {
        if (!open) return undefined
        const onDown = (event) => {
          const root = rootRef.current
          if (
            root &&
            event.target instanceof Node &&
            !root.contains(event.target) &&
            !(popoverRef.current && popoverRef.current.contains(event.target))
          ) {
            setOpen(false)
          }
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onDown)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      React.useEffect(() => {
        if (!open) return undefined
        const layoutPopover = () => {
          const root = rootRef.current
          if (!root) return
          const rect = root.getBoundingClientRect()
          const margin = 16
          const titlebarBottom = measureTitlebarBottom()
          // 顶部不能进标题栏（窗口按钮会盖住），左右和底部都留出边距。
          const safeTop = Math.max(margin, titlebarBottom + 8)
          const viewportWidth = document.documentElement?.clientWidth ?? window.innerWidth
          const viewportHeight = window.innerHeight
          const width = Math.max(180, Math.min(360, viewportWidth - margin * 2))
          const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin))
          const spaceAbove = Math.max(0, rect.top - safeTop - 8)
          const spaceBelow = Math.max(0, viewportHeight - rect.bottom - margin - 8)
          const placeUp = spaceAbove >= 380 || spaceAbove >= spaceBelow
          const available = placeUp ? spaceAbove : spaceBelow
          const maxHeight = Math.min(560, Math.max(120, available))
          const top = placeUp
            ? Math.max(safeTop, rect.top - 8 - maxHeight)
            : Math.min(rect.bottom + 8, viewportHeight - margin - Math.min(maxHeight, 160))
          setPopoverStyle((previous) => {
            if (
              previous &&
              previous.position === 'fixed' &&
              previous.left === left &&
              previous.top === top &&
              previous.width === width &&
              previous.maxHeight === maxHeight
            ) {
              return previous
            }
            return { position: 'fixed', left, top, width, maxHeight }
          })
        }
        layoutPopover()
        let frame = 0
        const scheduleLayout = () => {
          if (frame !== 0) return
          frame = window.requestAnimationFrame(() => {
            frame = 0
            layoutPopover()
          })
        }
        window.addEventListener('resize', scheduleLayout)
        return () => {
          if (frame !== 0) window.cancelAnimationFrame(frame)
          window.removeEventListener('resize', scheduleLayout)
        }
      }, [open])

      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        const load = () => {
          fetch(API + '/session-prefs?sessionId=' + encodeURIComponent(sessionId), { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : undefined))
            .then((data) => {
              if (alive && data?.prefs) setSessionPrefs(data.prefs)
            })
            .catch(() => {})
        }
        load()
        const timer = setInterval(load, 2500)
        return () => {
          alive = false
          clearInterval(timer)
        }
      }, [sessionId])

      const write = (key, value) => {
        if (!scope || typeof scope.set !== 'function') return
        Promise.resolve()
          .then(() => scope.set(key, value))
          .catch(() => {})
      }
      const writeSession = (key, value) => {
        if (!sessionId) return
        const previous = sessionPrefs ?? { skipClarify: false }
        const next = { ...previous, [key]: value }
        setSessionPrefs(next)
        fetch(API + '/session-prefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, [key]: value }),
        })
          .then((response) => (response.ok ? response.json() : undefined))
          .then((data) => {
            if (data?.prefs) setSessionPrefs(data.prefs)
          })
          .catch(() => setSessionPrefs(previous))
      }

      // 弹层优先挂到 body（createPortal），这样任何祖先容器的 overflow / transform 都裁不到它。
      const portalize = (node) => {
        if (!node) return null
        try {
          if (
            ReactDOM &&
            typeof ReactDOM.createPortal === 'function' &&
            typeof document !== 'undefined' &&
            document.body
          ) {
            return ReactDOM.createPortal(node, document.body)
          }
        } catch {}
        return node
      }

      return h(
        'div',
        { ref: rootRef, style: { position: 'relative', display: 'inline-flex' } },
        h('style', null, STYLE),
        h(
          'div',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              height: 28,
              padding: '0 4px 0 8px',
              borderRadius: tokens.radiusMd,
              border: '0.5px solid ' + (enabled && !skipped ? tokens.borderStrong : 'transparent'),
            },
          },
          h(
            'button',
            {
              type: 'button',
              title: t('quickTitle'),
              onClick: () => write('enabled', !enabled),
              disabled: !writable,
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 24,
                padding: '0 5px 0 2px',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: enabled && !skipped ? tokens.text : tokens.tertiary,
                font: 'inherit',
                fontSize: 13,
                cursor: writable ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              },
            },
            h('span', {
              style: {
                width: 7,
                height: 7,
                borderRadius: '50%',
                display: 'inline-block',
                background: enabled && !skipped ? tokens.accent : tokens.borderStrong,
              },
            }),
            h('span', null, t('quickLabel')),
            h('span', { style: { color: tokens.caption, fontSize: 12 } }, stateText),
          ),
          h(
            'button',
            {
              type: 'button',
              title: t('quickTitle'),
              onClick: () => setOpen((current) => !current),
              'aria-expanded': open ? 'true' : 'false',
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                padding: 0,
                borderRadius: 6,
                border: 'none',
                background: open ? tokens.hover : 'transparent',
                color: tokens.caption,
                cursor: 'pointer',
              },
            },
            h(GearIcon),
          ),
        ),
        open
          ? portalize(
              h(
                'div',
                {
                  ref: popoverRef,
                  className: 'dshpf-pop',
                  style: {
                    zIndex: 2147483000,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    // 右侧只留 2px，让滚动条贴着面板右边框，和 DSH 主面板一致；文字间距由内层 padding 负责。
                    padding: '12px 2px 12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    borderRadius: tokens.radiusLg,
                    border: '0.5px solid ' + tokens.cardStroke,
                    background: tokens.cardFill,
                    boxShadow: tokens.shadow,
                    color: tokens.text,
                    ...(popoverStyle ?? { position: 'fixed', left: 12, bottom: 80, width: 360, maxHeight: 420 }),
                  },
                },
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      flex: '1 1 auto',
                      minHeight: 0,
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      scrollbarGutter: 'stable',
                      // 文字与滚动条之间留一点距离，滚动条本身贴内层右边缘。
                      paddingRight: 10,
                    },
                  },
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0 } },
                  h('span', { style: { fontSize: 10, lineHeight: '14px', color: tokens.caption } }, 'dsh-HelpMe-To-Ask'),
                  h('span', { style: { fontSize: 13, fontWeight: 500 } }, t('quickTitle')),
                ),
                h(
                  'span',
                  { style: { marginLeft: 'auto' } },
                  h(Toggle, { checked: enabled, disabled: !writable, onChange: (next) => write('enabled', next) }),
                ),
              ),
              h('div', { style: { fontSize: 12, color: tokens.secondary, marginTop: 2 } }, t('foldAsk')),
              h(TriggerPicker, {
                t,
                value: trigger === 'off' || trigger === 'always' || trigger === 'complex' ? trigger : 'vague',
                disabled: !writable,
                sessionSkipped: skipped,
                onSelectSession: (next) => writeSession('skipClarify', next),
                onceArmed: sessionPrefs?.onceArmed === true,
                onSelectOnce: (next) => writeSession('onceArmed', next),
                onChange: (next) => write('triggerMode', next),
              }),
              h('div', { style: { fontSize: 11, lineHeight: '16px', color: tokens.caption } }, t('triggerHint')),              h('div', { style: { fontSize: 12, color: tokens.secondary, marginTop: 2 } }, t('sectionBehavior')),
              h(Row, {
                label: t('moreBriefConfirm'),
                hint: t('moreBriefConfirmHint'),
                children: h(Toggle, {
                  checked: valueOf('briefConfirm') === true,
                  disabled: !writable,
                  onChange: (next) => write('briefConfirm', next),
                }),
              }),
              h(Row, {
                label: t('moreRound'),
                hint: t('roundsHint'),
                children: h(
                  'select',
                  {
                    value: String(valueOf('maxClarifyRounds')),
                    disabled: !writable,
                    style: { ...styles.input, width: 90 },
                    onChange: (event) => write('maxClarifyRounds', Number(event.target.value)),
                  },
                  Array.from({ length: 10 }, (_, index) => index + 1).map((count) =>
                    h('option', { key: count, value: String(count) }, String(count)),
                  ),
                ),
              }),
              h('div', { style: { fontSize: 11, lineHeight: '16px', color: tokens.caption } }, t('quickHint')),
              ),
              ),
            )
          : null,
      )
    }

    /* ---------------- 设置页 ---------------- */

    /** 大脑模型选择：从客户端模型目录自动读取模型与其推理档位，下拉选择。 */
    function BrainSection(props) {
      const { t, valueOf, writeMany, disabled, loadCatalog } = props
      const [catalog, setCatalog] = React.useState(undefined)
      const [failed, setFailed] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        Promise.resolve()
          .then(() => loadCatalog())
          .then((value) => {
            if (alive) setCatalog(value ?? null)
          })
          .catch(() => {
            if (alive) {
              setCatalog(null)
              setFailed(true)
            }
          })
        return () => {
          alive = false
        }
      }, [loadCatalog])

      const groups = Array.isArray(catalog?.groups) ? catalog.groups : []
      const models = []
      for (const group of groups) {
        for (const model of group.models ?? []) {
          models.push({
            provider: group.id,
            providerLabel: typeof group.label === 'string' && group.label !== '' ? group.label : group.id,
            id: model.id,
            name: model.name ?? model.id,
            efforts: Array.isArray(model.reasoning?.efforts)
              ? model.reasoning.efforts
                  .filter((effort) => effort && (typeof effort === 'string' || typeof effort.id === 'string'))
                  .map((effort) => (typeof effort === 'string' ? { id: effort, name: effort } : { id: effort.id, name: typeof effort.name === 'string' ? effort.name : effort.id }))
              : [],
          })
        }
      }
      const selectedProvider = String(valueOf('brainProvider') ?? '')
      const selectedModel = String(valueOf('brainModel') ?? '')
      const selected = models.find((m) => m.provider === selectedProvider && m.id === selectedModel)
      const selectionValue = selected ? selectedProvider + '|' + selectedModel : ''
      const effortValue = String(valueOf('brainEffort') ?? '')

      const setAuto = () =>
        writeMany([
          { op: 'set', path: ['brainProvider'], value: '' },
          { op: 'set', path: ['brainModel'], value: '' },
          { op: 'set', path: ['brainEffort'], value: '' },
        ])
      const setModel = (value) => {
        if (!value) {
          setAuto()
          return
        }
        const [provider, model] = value.split('|')
        writeMany([
          { op: 'set', path: ['brainProvider'], value: provider },
          { op: 'set', path: ['brainModel'], value: model },
          { op: 'set', path: ['brainEffort'], value: '' },
        ])
      }
      const setEffort = (value) => writeMany([{ op: 'set', path: ['brainEffort'], value }])

      return h(
        'div',
        { style: styles.card },
        h('p', { style: styles.hint }, t('brainHint')),
        h(Row, {
          label: t('brainModelLabel'),
          children: h(
            'select',
            {
              value: selectionValue,
              disabled: disabled === true || models.length === 0,
              style: { ...styles.input, width: 320 },
              onChange: (event) => setModel(event.target.value),
            },
            h('option', { value: '' }, t('brainAuto')),
            models.map((model) =>
              h(
                'option',
                { key: model.provider + '|' + model.id, value: model.provider + '|' + model.id },
                (model.providerLabel ?? model.provider) + ' · ' + model.name,
              ),
            ),
          ),
        }),
        h(Row, {
          label: t('brainEffort'),
          children: h(
            'select',
            {
              value: effortValue,
              disabled: disabled === true || !selected,
              style: { ...styles.input, width: 200 },
              onChange: (event) => setEffort(event.target.value),
            },
            h('option', { value: '' }, t('brainEffortAuto')),
            (selected?.efforts ?? []).map((effort) =>
              h('option', { key: effort.id, value: effort.id }, effort.name || effort.id),
            ),
          ),
        }),
        catalog === undefined ? h('p', { style: styles.hint }, t('brainCatalogLoading')) : null,
        failed ? h('p', { style: styles.hint }, t('brainCatalogFail')) : null,
        models.length === 0 && catalog !== undefined && !failed
          ? h('p', { style: styles.hint }, t('brainCatalogFail'))
          : null,
      )
    }

    function SettingsPage(props) {
      const { scope, t, loadCatalog } = props
      const [writeState, setWriteState] = React.useState(undefined)
      const [brainOpen, setBrainOpen] = React.useState(false)
      const { snapshot, valueOf } = useScopeValues(scope)
      const writable = snapshot.writable === true
      const write = (key, value) => {
        if (!scope || typeof scope.mutate !== 'function') {
          setWriteState({ kind: 'error', text: t('unavailable') })
          return
        }
        setWriteState({ kind: 'saving', text: t('saving') })
        Promise.resolve()
          .then(() => scope.mutate([{ op: 'set', path: [key], value }]))
          .then((ok) => setWriteState({ kind: ok ? 'ok' : 'error', text: ok ? t('saved') : t('saveFailed') }))
          .catch(() => setWriteState({ kind: 'error', text: t('saveFailed') }))
      }
      const writeMany = (ops) => {
        if (!scope || typeof scope.mutate !== 'function') {
          setWriteState({ kind: 'error', text: t('unavailable') })
          return
        }
        setWriteState({ kind: 'saving', text: t('saving') })
        Promise.resolve()
          .then(() => scope.mutate(ops))
          .then((ok) => setWriteState({ kind: ok ? 'ok' : 'error', text: ok ? t('saved') : t('saveFailed') }))
          .catch(() => setWriteState({ kind: 'error', text: t('saveFailed') }))
      }
      const reset = () => {
        if (!scope || typeof scope.mutate !== 'function') return
        const ops = Object.keys(DEFAULTS).map((key) => ({ op: 'unset', path: [key] }))
        setWriteState({ kind: 'saving', text: t('saving') })
        Promise.resolve()
          .then(() => scope.mutate(ops))
          .then((ok) => setWriteState({ kind: ok ? 'ok' : 'error', text: ok ? t('saved') : t('saveFailed') }))
          .catch(() => setWriteState({ kind: 'error', text: t('saveFailed') }))
      }

      if (snapshot.status === 'loading') {
        return h('div', { style: styles.page }, h('h2', { style: styles.title }, t('title')), h('p', { style: styles.intro }, t('loading')))
      }
      if (scope === undefined || scope === null) {
        return h('div', { style: styles.page }, h('h2', { style: styles.title }, t('title')), h('p', { style: styles.intro }, t('unavailable')))
      }
      const enabled = valueOf('enabled') === true
      const trigger = valueOf('triggerMode')
      const disabled = !writable

      return h(
        'div',
        { style: styles.page },
        h('h2', { style: styles.title }, t('title')),
        h('p', { style: styles.intro }, t('intro')),
        h('div', { style: styles.sectionTitle }, t('basics')),
        h(
          'div',
          { style: styles.card },
          h(Row, {
            label: t('enabledLabel'),
            children: h(Toggle, { checked: enabled, disabled, onChange: (next) => write('enabled', next) }),
          }),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h('div', { style: styles.label }, t('trigger')),
            h(TriggerPicker, {
              t,
              value: trigger === 'off' || trigger === 'always' || trigger === 'complex' ? trigger : 'vague',
              disabled,
              onChange: (next) => write('triggerMode', next),
            }),
            h('div', { style: styles.hint }, t('triggerHint')),
          ),
          h(Row, {
            label: t('watchTurns'),
            hint: t('watchTurnsHint'),
            children: h(Toggle, { checked: valueOf('watchTurns') === true, disabled, onChange: (next) => write('watchTurns', next) }),
          }),
          h(Row, {
            label: t('briefConfirm'),
            hint: t('briefConfirmHint'),
            children: h(Toggle, { checked: valueOf('briefConfirm') === true, disabled, onChange: (next) => write('briefConfirm', next) }),
          }),
          h(Row, {
            label: t('rounds'),
            hint: t('roundsHint'),
            children: h(
              'select',
              {
                value: String(valueOf('maxClarifyRounds')),
                disabled,
                style: { ...styles.input, width: 110 },
                onChange: (event) => write('maxClarifyRounds', Number(event.target.value)),
              },
              Array.from({ length: 10 }, (_, index) => index + 1).map((count) =>
                h('option', { key: count, value: String(count) }, String(count)),
              ),
            ),
          }),
        ),
        h(Fold, {
          title: t('foldBrain'),
          open: brainOpen,
          onToggle: () => setBrainOpen((current) => !current),
          children: h(BrainSection, { t, valueOf, writeMany, disabled, loadCatalog }),
        }),
        writable ? null : h('p', { style: styles.hint }, t('unavailable')),
        writeState ? h('p', { style: styles.status(writeState.kind) }, writeState.text) : null,
        h('button', { type: 'button', style: styles.resetButton, onClick: reset, disabled }, t('reset')),
      )
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        let scope
        try {
          scope = ctx.configForms.get(ROW_ID)
        } catch (error) {
          scope = undefined
          try {
            console.warn('[dsh-help-me-to-ask] config form unavailable', error)
          } catch {}
        }
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'dsh-help-me-to-ask: dictionaries')

        // 从客户端模型目录读取"用户客户端内有的模型 + 对应推理能力"
        const loadCatalog = async () => {
          // 首选插件自己的宿主路由（与大脑选型同一份模型目录），不依赖客户端 remote 服务
          try {
            const response = await fetch(API + '/models', { cache: 'no-store' })
            if (response.ok) {
              const data = await response.json()
              if (data?.ok === true && Array.isArray(data.groups)) return { groups: data.groups }
            }
          } catch {}
          // 兜底：直接读客户端模型目录服务
          try {
            const remote = ctx.get('remote')
            const response = await remote?.session?.modelCatalog?.()
            if (response && response.ok === true) return response.value
            if (response && Array.isArray(response.groups)) return response
          } catch {}
          return undefined
        }

        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            { name: 'conversation.input.dock', id: 'dsh-help-me-to-ask-pending', order: 5, locale: NS, inject: () => ({ scope }) },
            PendingCard,
          ),
        )
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            { name: 'conversation.input.left', id: 'dsh-help-me-to-ask-quick', order: 10, locale: NS, inject: () => ({ scope, t }) },
            QuickControls,
          ),
        )
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-help-me-to-ask',
              order: 60,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ scope, t, loadCatalog }),
            },
            SettingsPage,
          ),
        )
      },
    }
  },
})
