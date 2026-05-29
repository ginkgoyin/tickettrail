import type { ComponentProps } from "react";
import { Dashboard } from "../components/Dashboard";
import { SmartImport } from "../components/SmartImport";
import { TicketForm } from "../components/TicketForm";
import { TicketList } from "../components/TicketList";

type SmartImportProps = ComponentProps<typeof SmartImport>;
type TicketFormProps = ComponentProps<typeof TicketForm>;
type TicketListProps = ComponentProps<typeof TicketList>;
type DashboardProps = ComponentProps<typeof Dashboard>;

interface TicketsPageProps {
  importProps: SmartImportProps;
  formProps: TicketFormProps;
  listProps: TicketListProps;
  dashboardProps: DashboardProps;
}

export function TicketsPage({
  importProps,
  formProps,
  listProps,
  dashboardProps,
}: TicketsPageProps) {
  return (
    <section className="content-grid">
      <div className="panel-stack">
        <SmartImport {...importProps} />
        <TicketForm {...formProps} />
        <TicketList {...listProps} />
      </div>
      <Dashboard {...dashboardProps} />
    </section>
  );
}
