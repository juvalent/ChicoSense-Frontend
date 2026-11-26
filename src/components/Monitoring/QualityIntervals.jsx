import { useEffect, useState } from "react";
import api from "../../services/api";
import Button from "../UI/Button";
import { lifecycleError } from "../../services/monitoringLifecycleService";

export default function QualityIntervals({ sessionId, result }) {
  const [offset, setOffset] = useState(0), [refresh, setRefresh] = useState(0), [view, setView] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data } = await api.get(`/api/v1/monitoramentos/${encodeURIComponent(sessionId)}/qualidade/intervalos`, { signal: controller.signal,
          params: { inicio: result.inicio, fim: result.fim, revisao: result.revisao, intervalo_maximo_s: result.intervalo_maximo_s, limit: 20, offset } });
        if (data?.sessao_id !== sessionId || data.revisao !== result.revisao || data.inicio !== result.inicio || data.fim !== result.fim || !Array.isArray(data.intervalos) || !Number.isInteger(data.total)) throw new Error("Janela de qualidade incompatível.");
        if (!controller.signal.aborted) setView({ data, loading: false });
      } catch (error) { if (!controller.signal.aborted) setView({ loading: false, error: lifecycleError(error) }); }
    }
    load(); return () => controller.abort();
  }, [sessionId, result, offset, refresh]);
  return <section aria-label="Intervalos de cobertura paginados"><h3>Intervalos de cobertura da aquisição</h3>
    {view.loading && <p role="status">Consultando intervalos…</p>}{view.error && <p role="alert">{view.error}</p>}
    {view.data && <><p>{view.data.total} intervalos na revisão {result.revisao} · Página {offset / 20 + 1}</p>
      <ul>{view.data.intervalos.map((row,index) => <li key={`${row.sensor_id}:${row.inicio}:${index}`}>{row.tipo} · {row.inicio} → {row.fim} · {row.duracao_s} s · {row.motivo || "Coberto"}</li>)}</ul>
      <Button variant="secondary" disabled={view.loading || offset === 0} onClick={() => { setView({ loading: true }); setOffset(offset - 20); }}>Intervalos anteriores</Button>
      <Button variant="secondary" disabled={view.loading || offset + 20 >= view.data.total} onClick={() => { setView({ loading: true }); setOffset(offset + 20); }}>Próximos intervalos</Button></>}
    <Button variant="secondary" disabled={view.loading} onClick={() => { setView({ loading: true }); setRefresh((n) => n + 1); }}>Atualizar intervalos</Button>
  </section>;
}
