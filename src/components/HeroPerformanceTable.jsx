import { toPercent } from '../utils/metrics.js';

const fallbackCopy = {
  title: '英雄表现对比',
  tag: '支持排序/筛选/导出',
  headers: {
    hero: '英雄',
    attribute: '属性',
    role: '定位',
    matches: '场次',
    winRate: '胜率',
    avgKda: '平均 KDA',
    avgGpm: '平均 GPM',
    avgXpm: '平均 XPM',
    impact: '影响力',
  },
  controls: {
    sortLabel: '排序字段',
    sortDirectionLabel: '排序方向',
    attributeLabel: '属性筛选',
    roleLabel: '分路筛选',
    minMatchesLabel: '最少场次',
    export: '导出 CSV',
    roleAll: '全部分路',
    attributeAll: '全部属性',
    sortOptions: {
      impact: '影响力',
      matches: '场次',
      winRate: '胜率',
      avgKda: '平均 KDA',
      avgGpm: '平均 GPM',
      avgXpm: '平均 XPM',
      hero: '英雄名',
    },
    directionOptions: {
      desc: '降序',
      asc: '升序',
    },
    resultCount: (count) => `共 ${count} 个英雄`,
  },
  empty: '当前筛选条件下没有英雄统计数据。',
};

function HeroPerformanceTable({
  heroes,
  attributes = [],
  roles = [],
  controls,
  onSortKeyChange,
  onSortDirChange,
  onAttributeFilterChange,
  onRoleFilterChange,
  onMinMatchesChange,
  onExport,
  copy = fallbackCopy,
}) {
  const activeControls = controls ?? {
    sortKey: 'impact',
    sortDir: 'desc',
    attributeFilter: 'all',
    roleFilter: 'all',
    minMatches: 0,
  };

  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <span className="panel-tag">{copy.controls.resultCount(heroes.length)}</span>
      </div>
      <div className="table-controls" role="group" aria-label={copy.title}>
        <label>
          <span>{copy.controls.sortLabel}</span>
          <select value={activeControls.sortKey} onChange={(event) => onSortKeyChange?.(event.target.value)}>
            {Object.entries(copy.controls.sortOptions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.controls.sortDirectionLabel}</span>
          <select value={activeControls.sortDir} onChange={(event) => onSortDirChange?.(event.target.value)}>
            {Object.entries(copy.controls.directionOptions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.controls.attributeLabel}</span>
          <select
            value={activeControls.attributeFilter}
            onChange={(event) => onAttributeFilterChange?.(event.target.value)}
          >
            <option value="all">{copy.controls.attributeAll}</option>
            {attributes.map((attribute) => (
              <option key={attribute} value={attribute}>
                {attribute}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.controls.roleLabel}</span>
          <select value={activeControls.roleFilter} onChange={(event) => onRoleFilterChange?.(event.target.value)}>
            <option value="all">{copy.controls.roleAll}</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{copy.controls.minMatchesLabel}</span>
          <input
            type="number"
            min="0"
            step="1"
            value={activeControls.minMatches}
            onChange={(event) => onMinMatchesChange?.(event.target.value)}
          />
        </label>
        <button type="button" className="table-export-btn" onClick={onExport} disabled={heroes.length === 0}>
          {copy.controls.export}
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.headers.hero}</th>
              <th>{copy.headers.attribute}</th>
              <th>{copy.headers.role}</th>
              <th>{copy.headers.matches}</th>
              <th>{copy.headers.winRate}</th>
              <th>{copy.headers.avgKda}</th>
              <th>{copy.headers.avgGpm}</th>
              <th>{copy.headers.avgXpm}</th>
              <th>{copy.headers.impact}</th>
            </tr>
          </thead>
          <tbody>
            {heroes.length > 0 ? (
              heroes.map((hero) => (
                <tr key={hero.heroId ?? hero.hero}>
                  <td>
                    <div className="hero-name-cell">
                      {hero.heroAvatar ? <img src={hero.heroAvatar} alt={hero.hero} className="hero-avatar" loading="lazy" /> : null}
                      <span>{hero.hero}</span>
                    </div>
                  </td>
                  <td>{hero.attribute}</td>
                  <td>{hero.role}</td>
                  <td>{hero.matches}</td>
                  <td>{toPercent(hero.wins, hero.matches)}%</td>
                  <td>{hero.avgKda}</td>
                  <td>{Number.isFinite(hero.avgGpm) ? hero.avgGpm : '-'}</td>
                  <td>{Number.isFinite(hero.avgXpm) ? hero.avgXpm : '-'}</td>
                  <td>
                    <div className="impact-cell">
                      <span>{hero.impact}</span>
                      <div className="impact-bar">
                        <i style={{ width: `${hero.impact}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="empty-cell">
                  {copy.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default HeroPerformanceTable;
