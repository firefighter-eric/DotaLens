import StatCard from './components/StatCard.jsx';
import WinRateTrend from './components/WinRateTrend.jsx';
import HeroPerformanceTable from './components/HeroPerformanceTable.jsx';
import RankDistribution from './components/RankDistribution.jsx';
import { dailyWinRate, heroPerformance, rankDistribution } from './data/mockDotaData.js';
import { summarizeDashboard } from './utils/metrics.js';

const metrics = summarizeDashboard(heroPerformance);

function App() {
  return (
    <div className="app-shell">
      <header className="hero-header">
        <div className="hero-header__content">
          <p className="eyebrow">DotaLens Analytics</p>
          <h1>你的 Dota 数据分析工作台</h1>
          <p className="description">
            聚合英雄表现、胜率趋势和段位分布，帮助你在每个版本快速定位最有价值的打法。
          </p>
        </div>
      </header>

      <main className="dashboard">
        <section className="stats-grid">
          <StatCard
            label="总对局场次"
            value={metrics.totalMatches}
            subtext="来自最近 30 天的统计样本"
            accent="gold"
          />
          <StatCard
            label="综合胜率"
            value={`${metrics.overallWinRate}%`}
            subtext="全英雄加权结果"
            accent="teal"
          />
          <StatCard
            label="平均 KDA"
            value={metrics.avgKda}
            subtext="按英雄平均值计算"
            accent="red"
          />
          <StatCard
            label="最高价值英雄"
            value={metrics.bestHero.hero}
            subtext={`影响力 ${metrics.bestHero.impact} / 平均 GPM ${metrics.bestHero.avgGpm}`}
            accent="blue"
          />
        </section>

        <section className="two-cols">
          <WinRateTrend data={dailyWinRate} />
          <RankDistribution items={rankDistribution} />
        </section>

        <HeroPerformanceTable heroes={heroPerformance} />
      </main>
    </div>
  );
}

export default App;
