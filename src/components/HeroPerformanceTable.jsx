import { toPercent } from '../utils/metrics.js';

const fallbackCopy = {
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
};

function HeroPerformanceTable({ heroes, copy = fallbackCopy }) {
  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h2>{copy.title}</h2>
        <span className="panel-tag">{copy.tag}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{copy.headers.hero}</th>
              <th>{copy.headers.role}</th>
              <th>{copy.headers.matches}</th>
              <th>{copy.headers.winRate}</th>
              <th>{copy.headers.avgKda}</th>
              <th>{copy.headers.avgGpm}</th>
              <th>{copy.headers.impact}</th>
            </tr>
          </thead>
          <tbody>
            {heroes.length > 0 ? (
              heroes
                .slice()
                .sort((a, b) => b.impact - a.impact)
                .map((hero) => (
                  <tr key={hero.hero}>
                    <td>{hero.hero}</td>
                    <td>{hero.role}</td>
                    <td>{hero.matches}</td>
                    <td>{toPercent(hero.wins, hero.matches)}%</td>
                    <td>{hero.avgKda}</td>
                    <td>{hero.avgGpm}</td>
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
                <td colSpan={7} className="empty-cell">
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
