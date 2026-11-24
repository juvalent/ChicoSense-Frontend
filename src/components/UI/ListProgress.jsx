import Button from "./Button";
import "../Logistics/Logistics.css";
export default function ListProgress({ list, label, disabled = false }) {
  return <nav className="logistics-actions" aria-label={`Paginação: ${label}`}>
    <span>Registros carregados de {label}: {list.records.length}{list.hasNext ? " · há mais registros" : ""}. Filtros e contagens consideram os registros carregados.</span>
    {list.loading && <span role="status">Carregando {label}…</span>}
    {list.error && <span role="alert">{list.error}</span>}
    {list.hasNext && <Button variant="secondary" disabled={disabled || list.loading} onClick={list.more}>Carregar mais {label}</Button>}
    <Button variant="secondary" disabled={disabled || list.loading} onClick={list.retry}>Atualizar lista de {label}</Button>
  </nav>;
}
