import { useEffect, useState } from "react";
import Select from "../UI/Select";
import Button from "../UI/Button";
import { LOGISTICS_PAGE_SIZE, logisticsError, readReferencePage } from "../../services/logisticsService";
import { partnerPage } from "../../services/backendIntegrationService";

export default function ReferenceSelect({ label, kind, companyType, carrierId, value, onChange, required, disabled }) {
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [view, setView] = useState({ records: [], hasNext: false, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setView({ records: [], hasNext: false, loading: true, error: "" });
      try {
        const data = carrierId && companyType ? await partnerPage(carrierId, companyType, offset, controller.signal) : await readReferencePage(kind, offset, controller.signal);
        if (!controller.signal.aborted) setView({ ...data, loading: false, error: "" });
      } catch (error) { if (!controller.signal.aborted) setView({ records: [], hasNext: false, loading: false, error: logisticsError(error) }); }
    }
    load();
    return () => controller.abort();
  }, [kind, companyType, carrierId, offset, refresh]);
  const options = view.records.filter((item) => item.ativo === true && (!companyType || item.tipo === companyType));
  return <div>
    <Select label={label} value={value} required={required} disabled={disabled || view.loading || Boolean(view.error)} onChange={(event) => onChange(event.target.value)}
      options={[{ value: "", label: required ? "Selecione uma opção" : "Não informado" }, ...options.map((item) => ({ value: item.id, label: item.nome }))]} />
    {view.loading && <p role="status">Consultando opções de {label.toLowerCase()}…</p>}
    {view.error && <p role="alert">{view.error}</p>}
    {!view.loading && !view.error && options.length === 0 && <p>Nenhuma opção compatível nesta página de {label.toLowerCase()}. Use as próximas opções, se disponíveis.</p>}
    <div className="logistics-actions">
      <Button variant="secondary" disabled={disabled || view.loading || offset === 0} onClick={() => { onChange(""); setOffset((n) => Math.max(0, n - LOGISTICS_PAGE_SIZE)); }}>Opções anteriores de {label.toLowerCase()}</Button>
      <Button variant="secondary" disabled={disabled || view.loading || !view.hasNext} onClick={() => { onChange(""); setOffset((n) => n + LOGISTICS_PAGE_SIZE); }}>Próximas opções de {label.toLowerCase()}</Button>
      {view.error && <Button variant="secondary" disabled={disabled || view.loading} onClick={() => setRefresh((n) => n + 1)}>Atualizar opções de {label.toLowerCase()}</Button>}
    </div>
  </div>;
}
