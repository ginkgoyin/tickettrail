import type { ComponentProps } from "react";
import { Dashboard } from "../components/Dashboard";
import { StatisticsPanel } from "../components/StatisticsPanel";

type StatisticsPanelProps = ComponentProps<typeof StatisticsPanel>;
type DashboardProps = ComponentProps<typeof Dashboard>;

interface HomePageProps {
  statisticsProps: StatisticsPanelProps;
  dashboardProps: DashboardProps;
}

export function HomePage({ statisticsProps, dashboardProps }: HomePageProps) {
  return (
    <section className="content-grid">
      <div className="panel-stack">
        <StatisticsPanel {...statisticsProps} />
      </div>
      <Dashboard {...dashboardProps} />
    </section>
  );
}
