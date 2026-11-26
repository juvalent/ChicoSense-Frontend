import { useEffect, useState } from "react";

import {
  Pencil,
  RefreshCw,
  Search,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Card from "../UI/Card";
import Button from "../UI/Button";

import CargoMonitoringPanel from "../Monitoring/CargoMonitoringPanel";
import LogisticsEditor from "./LogisticsEditor";

import {
  canCreateLogistics,
  canOperateTrip,
  LOGISTICS_PAGE_SIZE,
  logisticsError,
  readLogistics,
} from "../../services/logisticsService";

import "./Logistics.css";

// ==========================================
// FORMATAÇÃO VISUAL DOS ESTADOS
// ==========================================

const statusLabels = {
  EM_TRANSITO: "Em trânsito",
  EM_ANDAMENTO: "Em andamento",
  PROGRAMADA: "Programada",
  PROGRAMADO: "Programado",
  PENDENTE: "Pendente",
  CRIADA: "Criada",
  CRIADO: "Criado",
  CADASTRADA: "Cadastrada",
  CADASTRADO: "Cadastrado",
  CARREGADA: "Carregada",
  CARREGADO: "Carregado",
  ENTREGUE: "Entregue",
  CONCLUIDA: "Concluída",
  CONCLUIDO: "Concluído",
  FINALIZADA: "Finalizada",
  FINALIZADO: "Finalizado",
  CANCELADA: "Cancelada",
  CANCELADO: "Cancelado",
  ATIVA: "Ativa",
  ATIVO: "Ativo",
  INATIVA: "Inativa",
  INATIVO: "Inativo",
};

function formatStatus(status) {
  if (!status) return "Não informado";

  return (
    statusLabels[status] ||
    String(status).replace(/_/g, " ")
  );
}

function statusTone(status) {
  if (
    [
      "EM_TRANSITO",
      "EM_ANDAMENTO",
      "ATIVA",
      "ATIVO",
      "CARREGADA",
      "CARREGADO",
    ].includes(status)
  ) {
    return "active";
  }

  if (
    [
      "CONCLUIDA",
      "CONCLUIDO",
      "ENTREGUE",
      "FINALIZADA",
      "FINALIZADO",
    ].includes(status)
  ) {
    return "success";
  }

  if (
    [
      "CANCELADA",
      "CANCELADO",
      "INATIVA",
      "INATIVO",
    ].includes(status)
  ) {
    return "danger";
  }

  if (
    [
      "PROGRAMADA",
      "PROGRAMADO",
      "PENDENTE",
    ].includes(status)
  ) {
    return "warning";
  }

  return "neutral";
}

// ==========================================
// FORMATAÇÃO DAS QUANTIDADES
// ==========================================

function formatQuantity(value, unit = "") {
  if (
    value == null ||
    String(value).trim() === ""
  ) {
    return "Não informado";
  }

  const number = Number(
    String(value).replace(",", ".")
  );

  const formatted = Number.isFinite(number)
    ? number.toLocaleString("pt-BR", {
        maximumFractionDigits: 4,
      })
    : String(value);

  return `${formatted} ${unit || ""}`.trim();
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function LogisticsRecords({
  kind,
  parentId,
  trip,
  cargo,
  user,
  busy,
  onBusy,
  initialCargoId,
  onMonitor,
}) {
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  const [page, setPage] = useState({
    records: [],
    hasNext: false,
    loading: true,
    error: "",
  });

  const [editor, setEditor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const canWrite = canOperateTrip(user, trip);

  const singular =
    kind === "cargas" ? "carga" : "caixa";

  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const visibleRecords = page.records.filter(
    (record) =>
      normalize(
        `${record.identificacao}
         ${record.status}
         ${formatStatus(record.status)}
         ${record.codigo_externo || ""}`
      ).includes(normalize(search))
  );

  // ==========================================
  // CONSULTA AO BACKEND
  // ==========================================

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setPage({
        records: [],
        hasNext: false,
        loading: true,
        error: "",
      });

      try {
        const data = await readLogistics(
          kind,
          parentId,
          {
            offset,
            signal: controller.signal,
          }
        );

        if (!controller.signal.aborted) {
          setPage({
            ...data,
            loading: false,
            error: "",
          });

          if (initialCargoId) {
            setDetail(
              data.records.find(
                (record) =>
                  record.id === initialCargoId
              ) || null
            );
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPage({
            records: [],
            hasNext: false,
            loading: false,
            error: logisticsError(error),
          });
        }
      }
    }

    load();

    return () => controller.abort();
  }, [
    kind,
    parentId,
    offset,
    refresh,
    initialCargoId,
  ]);

  // ==========================================
  // EDIÇÃO E ATUALIZAÇÃO
  // ==========================================

  function edit(record) {
    if (!busy && canWrite) {
      setNotice("");
      setDetail(null);
      setEditor({ record });
    }
  }

  function saved() {
    setEditor(null);
    setDetail(null);
    setOffset(0);
    setRefresh((n) => n + 1);

    setNotice(
      `${
        kind === "cargas"
          ? "Carga salva"
          : "Caixa salva"
      } com sucesso.`
    );
  }

  function atualizarRegistros() {
    setEditor(null);
    setDetail(null);
    setRefresh((n) => n + 1);
  }

  return (
    <Card className="logistics-records">

      {/* CABEÇALHO */}

      <div className="logistics-section-header">
        <div>
          <h2>
            {kind === "cargas"
              ? "Cargas da viagem"
              : `Caixas de ${cargo.identificacao}`}
          </h2>

          <p>
            {kind === "cargas"
              ? "Gerencie as cargas vinculadas à viagem selecionada."
              : "Consulte e gerencie as caixas vinculadas à carga."}
          </p>
        </div>

        <div className="logistics-header-actions">
          <Button
            variant="secondary"
            disabled={busy || page.loading}
            onClick={atualizarRegistros}
          >
            <RefreshCw
              size={16}
              className={
                page.loading ? "logistics-spin" : ""
              }
            />

            {page.loading
              ? "Atualizando..."
              : `Atualizar ${kind}`}
          </Button>

          {canWrite &&
            canCreateLogistics(kind, trip, cargo) && (
              <Button
                disabled={
                  busy ||
                  page.loading ||
                  Boolean(page.error)
                }
                onClick={() => edit(null)}
              >
                <Plus size={16} />

                Nova {singular}
              </Button>
            )}
        </div>
      </div>

      {/* AVISO DE SUCESSO */}

      {notice && (
        <div
          className="logistics-notice logistics-notice--success"
          role="status"
        >
          <Info size={20} />

          <div className="logistics-notice__content">
            <strong>{notice}</strong>
          </div>
        </div>
      )}

      {/* AVISO DE PERMISSÃO */}

      {!canWrite && (
        <div className="logistics-notice">
          <div className="logistics-notice__icon">
            <Info size={20} />
          </div>

          <div className="logistics-notice__content">
            <strong>Modo de consulta</strong>

            <p>
              Alterações exigem perfil de operação
              e vínculo com a transportadora desta
              viagem.
            </p>
          </div>
        </div>
      )}

      {/* FORMULÁRIO */}

      {editor && canWrite && (
        <LogisticsEditor
          key={editor.record?.id || "new"}
          kind={kind}
          parentId={parentId}
          trip={trip}
          cargo={cargo}
          record={editor.record}
          busy={busy}
          onBusy={onBusy}
          onSaved={saved}
          onCancel={() => setEditor(null)}
        />
      )}

      {/* CAMPO DE BUSCA */}

      <div className="logistics-search">
        <label htmlFor={`search-${kind}-${parentId}`}>
          Buscar {kind} nesta página
        </label>

        <div className="logistics-search__field">
          <Search
            size={18}
            className="logistics-search__icon"
          />

          <input
            id={`search-${kind}-${parentId}`}
            type="search"
            placeholder={`Buscar por identificação ou estado da ${singular}...`}
            value={search}
            disabled={busy || page.loading}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>
      </div>

      {/* ESTADOS DA CONSULTA */}

      {page.loading && (
        <p role="status">
          Consultando {kind}…
        </p>
      )}

      {page.error && (
        <div
          className="logistics-notice logistics-notice--error"
          role="alert"
        >
          <Info size={20} />

          <div className="logistics-notice__content">
            <strong>Não foi possível consultar</strong>

            <p>{page.error}</p>
          </div>
        </div>
      )}

      {!page.loading &&
        !page.error &&
        !page.records.length && (
          <div className="logistics-empty">
            Nenhum registro nesta página.
          </div>
        )}

      {!page.loading &&
        !page.error &&
        page.records.length > 0 &&
        visibleRecords.length === 0 && (
          <div className="logistics-empty">
            Nenhum resultado nesta página para a
            busca informada.
          </div>
        )}

      {/* TABELA */}

      {!!visibleRecords.length && (
        <div className="logistics-table">
          <table>
            <caption>
              {kind === "cargas"
                ? "Cargas desta viagem"
                : "Caixas desta carga"}
            </caption>

            <thead>
              <tr>
                <th scope="col">
                  Identificação
                </th>

                <th scope="col">
                  Estado
                </th>

                <th scope="col">
                  {kind === "cargas"
                    ? "Quantidade / unidade"
                    : "Peso informado"}
                </th>

                <th scope="col">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <span className="logistics-record-name">
                      {record.identificacao}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`logistics-status logistics-status--${statusTone(
                        record.status
                      )}`}
                    >
                      <span className="logistics-status__dot" />

                      {formatStatus(record.status)}
                    </span>
                  </td>

                  <td>
                    {kind === "cargas"
                      ? formatQuantity(
                          record.quantidade,
                          record.unidade
                        )
                      : formatQuantity(record.peso)}
                  </td>

                  <td>
                    <div className="logistics-table-actions">

                      {/* CANETINHA VERDE */}

                      {canWrite && (
                        <button
                          type="button"
                          className="logistics-edit-button"
                          disabled={busy}
                          onClick={() => edit(record)}
                          aria-label={`Editar ${record.identificacao}`}
                          title={`Editar ${singular}`}
                        >
                          <Pencil size={17} />
                        </button>
                      )}

                      {kind === "cargas" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            setEditor(null);
                            setDetail(record);
                          }}
                          aria-label={`Caixas e monitoramento de ${record.identificacao}`}
                        >
                          Caixas e monitoramento
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINAÇÃO */}

      <nav
        className="logistics-pagination"
        aria-label={`Paginação de ${kind}`}
      >
        <Button
          variant="secondary"
          disabled={
            busy ||
            page.loading ||
            offset === 0
          }
          onClick={() => {
            setEditor(null);
            setDetail(null);
            setSearch("");

            setOffset((n) =>
              Math.max(0, n - LOGISTICS_PAGE_SIZE)
            );
          }}
        >
          <ChevronLeft size={16} />

          Página anterior
        </Button>

        <span className="logistics-pagination__page">
          Página {offset / LOGISTICS_PAGE_SIZE + 1}
        </span>

        <Button
          variant="secondary"
          disabled={
            busy ||
            page.loading ||
            !page.hasNext
          }
          onClick={() => {
            setEditor(null);
            setDetail(null);
            setSearch("");

            setOffset(
              (n) => n + LOGISTICS_PAGE_SIZE
            );
          }}
        >
          Próxima página

          <ChevronRight size={16} />
        </Button>
      </nav>

      {/* DETALHES DA CARGA */}

      {detail && kind === "cargas" && (
        <div className="logistics-detail">

          <div className="logistics-section-header">
            <div>
              <h2>Detalhes da carga</h2>

              <p>{detail.identificacao}</p>
            </div>

            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDetail(null)}
            >
              Fechar carga
            </Button>
          </div>

          <CargoMonitoringPanel
            key={`monitoring:${detail.id}`}
            cargo={detail}
            trip={trip}
            user={user}
            onMonitor={onMonitor}
            busy={busy}
            onBusy={onBusy}
          />

          <LogisticsRecords
            key={`boxes:${detail.id}`}
            kind="caixas"
            parentId={detail.id}
            trip={trip}
            cargo={detail}
            user={user}
            busy={busy}
            onBusy={onBusy}
          />
        </div>
      )}
    </Card>
  );
}