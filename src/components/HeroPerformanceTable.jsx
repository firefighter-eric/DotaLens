import { toPercent } from '../utils/metrics.js';

function HeroPerformanceTable({ heroes }) {
  return (
    <section className="panel table-panel">
      <div className="panel-header">
        <h2>英雄表现对比</h2>
        <span className="panel-tag">按影响力排序</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>英雄</th>
              <th>定位</th>
              <th>场次</th>
              <th>胜率</th>
              <th>平均 KDA</th>
              <th>平均 GPM</th>
              <th>影响力</th>
            </tr>
          </thead>
          <tbody>
            {heroes
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
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default HeroPerformanceTable;
