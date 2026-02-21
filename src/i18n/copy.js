const copy = {
  zh: {
    app: {
      eyebrow: 'DotaLens Analytics',
      title: '你的 Dota 数据分析工作台',
      description: '聚合英雄表现、胜率趋势和段位分布，帮助你在每个版本快速定位最有价值的打法。',
      languageLabel: '语言',
      languages: {
        zh: '中文',
        en: 'English',
      },
    },
    query: {
      idTypeLabel: '玩家 ID 类型',
      idTypes: {
        steam: 'Steam32',
        opendota: 'OpenDota ID',
      },
      placeholders: {
        steam: '例如：898754153',
        opendota: '例如：86745912',
      },
      submit: '开始分析',
      loading: '分析中...',
      hints: {
        steam: '使用 Steam32（32 位 account_id）。',
        opendota: '使用 OpenDota 账号 ID（account_id）。',
      },
      rangeAriaLabel: '时间窗口切换',
      day14: '14 天',
      day30: '30 天',
    },
    status: {
      mock: '当前展示的是示例数据。输入 OpenDota ID 或 Steam32 后可查看真实对局分析。',
      steam: ({ playerName, rawId, days, totalMatches }) =>
        `当前玩家：${playerName}（Steam32: ${rawId}），统计窗口：最近 ${days} 天，共 ${totalMatches} 场。`,
      opendota: ({ playerName, accountId, days, totalMatches }) =>
        `当前玩家：${playerName}（OpenDota ID: ${accountId}），统计窗口：最近 ${days} 天，共 ${totalMatches} 场。`,
    },
    cards: {
      totalMatches: '总对局场次',
      totalMatchesSubtext: (days) => `来自最近 ${days} 天的统计样本`,
      overallWinRate: '综合胜率',
      overallWinRateSubtext: '全英雄加权结果',
      avgKda: '平均 KDA',
      avgKdaSubtext: '按英雄平均值计算',
      bestHero: '最高价值英雄',
      bestHeroSubtext: ({ impact, avgGpm }) => `影响力 ${impact} / 平均 GPM ${avgGpm}`,
    },
    trend: {
      title: (days) => `${days} 天胜率走势`,
      latestWinRate: (value) => `最新胜率 ${value}%`,
      noDataTag: '暂无可用数据',
      noDataText: '当前时间窗口没有对局数据。',
      ariaLabel: (days) => `${days}天胜率走势`,
    },
    rank: {
      title: '对局段位分布',
      tag: (days) => `最近 ${days} 天`,
      noDataText: '当前公开数据没有段位信息。',
    },
    table: {
      title: '英雄表现对比',
      tag: '按影响力排序',
      headers: {
        hero: '英雄',
        role: '定位',
        matches: '场次',
        winRate: '胜率',
        avgKda: '平均 KDA',
        avgGpm: '平均 GPM',
        impact: '影响力',
      },
      empty: '当前时间窗口没有英雄统计数据。',
    },
    errors: {
      openDotaNumeric: '请输入纯数字的 OpenDota 用户 ID。',
      steamNumeric: 'Steam32 需要输入纯数字 ID。',
      steamInvalid: 'Steam32 格式不正确，请检查输入。',
      fetchFailed: '拉取 OpenDota 数据失败，请稍后重试。',
    },
    misc: {
      samplePlayerName: '示例玩家',
    },
  },
  en: {
    app: {
      eyebrow: 'DotaLens Analytics',
      title: 'Your Dota Analytics Workspace',
      description:
        'Combine hero performance, win-rate trends, and rank distribution to identify the most valuable strategies in each patch.',
      languageLabel: 'Language',
      languages: {
        zh: '中文',
        en: 'English',
      },
    },
    query: {
      idTypeLabel: 'Player ID Type',
      idTypes: {
        steam: 'Steam32',
        opendota: 'OpenDota ID',
      },
      placeholders: {
        steam: 'Example: 898754153',
        opendota: 'Example: 86745912',
      },
      submit: 'Analyze',
      loading: 'Analyzing...',
      hints: {
        steam: 'Use Steam32 (32-bit account_id).',
        opendota: 'Use OpenDota account_id.',
      },
      rangeAriaLabel: 'Time window switch',
      day14: '14 Days',
      day30: '30 Days',
    },
    status: {
      mock: 'Showing sample data. Enter OpenDota ID or Steam32 to analyze real public matches.',
      steam: ({ playerName, rawId, days, totalMatches }) =>
        `Player: ${playerName} (Steam32: ${rawId}), window: last ${days} days, ${totalMatches} matches.`,
      opendota: ({ playerName, accountId, days, totalMatches }) =>
        `Player: ${playerName} (OpenDota ID: ${accountId}), window: last ${days} days, ${totalMatches} matches.`,
    },
    cards: {
      totalMatches: 'Total Matches',
      totalMatchesSubtext: (days) => `Sample from the last ${days} days`,
      overallWinRate: 'Overall Win Rate',
      overallWinRateSubtext: 'Weighted across all heroes',
      avgKda: 'Average KDA',
      avgKdaSubtext: 'Calculated from hero averages',
      bestHero: 'Top Value Hero',
      bestHeroSubtext: ({ impact, avgGpm }) => `Impact ${impact} / Avg GPM ${avgGpm}`,
    },
    trend: {
      title: (days) => `${days}-Day Win Rate Trend`,
      latestWinRate: (value) => `Latest win rate ${value}%`,
      noDataTag: 'No Data',
      noDataText: 'No matches found in this time window.',
      ariaLabel: (days) => `${days}-day win rate trend`,
    },
    rank: {
      title: 'Rank Distribution',
      tag: (days) => `Last ${days} Days`,
      noDataText: 'No public rank data in this time window.',
    },
    table: {
      title: 'Hero Performance Comparison',
      tag: 'Sorted by impact',
      headers: {
        hero: 'Hero',
        role: 'Role',
        matches: 'Matches',
        winRate: 'Win Rate',
        avgKda: 'Avg KDA',
        avgGpm: 'Avg GPM',
        impact: 'Impact',
      },
      empty: 'No hero stats available in this time window.',
    },
    errors: {
      openDotaNumeric: 'OpenDota ID must be digits only.',
      steamNumeric: 'Steam32 must be digits only.',
      steamInvalid: 'Invalid Steam32 format.',
      fetchFailed: 'Failed to fetch OpenDota data. Please try again later.',
    },
    misc: {
      samplePlayerName: 'Sample Player',
    },
  },
};

export const getCopy = (lang = 'zh') => copy[lang] ?? copy.zh;
