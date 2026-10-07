import {
  Boxes,
  Check,
  Route,
  TriangleAlert,
}                 from "lucide-react";
import MetricCard from "../../components/Cards/MetricCard";

const metrics = [
  {
    title:       "Viagens ativas",
    value:        12,
    description: "+2 nesta semana",
    icon:        Route,
    tone:        "neutral",
  },
  {
    title:       "Cargas monitoradas",
    value:        28,
    description: "Uva e manga",
    icon:        Boxes,
    tone:        "neutral",
  },
  {
    title:       "Condição normal",
    value:        23,
    description: "82% das cargas",
    icon:        Check,
    tone:        "success",
  },
  {
    title:       "Exigem atenção",
    value:        3,
    description: "1 crítica agora",
    icon:        TriangleAlert,
    tone:        "warning",
  },
];

export default function Dashboard({ user }) {
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className      ="dashboard">
      <div className    ="dashboard__heading">
        <span className ="dashboard__eyebrow">
          Visão geral
        </span>

        <h1 className   ="dashboard__title">
          {firstName ? `Olá, ${firstName}.` : "Olá."} Visão das suas cargas
        </h1>

        <p className   ="dashboard__description">
          Acompanhe as condições da cadeia fria e priorize o que
          precisa de atenção.
        </p>

        <span className="dashboard__demo">
          Dados de demonstração
        </span>
      </div>

      <section
        className  ="dashboard__metrics"
        aria-label ="Indicadores da operação"
      >
        {metrics.map(({ title, icon: Icon, ...metric }) => (
          <MetricCard
            key   ={title}
            title ={title}
            icon  ={<Icon size={22} />}
            {...metric}
          />
        ))}
      </section>
    </div>
  );
}