
import { useEffect, useState } from "react";

import {
  Info,
  FlaskConical,
  Package,
  Hash,
  CircleCheck,
  Circle,
  RefreshCw,
} from "lucide-react";

import Card from "../UI/Card";
import ClimateChart from "../Charts/ClimateChart";
import ListProgress from "../UI/ListProgress";

import {
  normalizarLeituras,
} from "../../services/monitoramentoService";

import useIncrementalList from "../../hooks/useIncrementalList";

import {
  tripSessionList,
} from "../../services/pagedLists";

import {
  loadSessionPage,
  READING_PAGE_SIZE,
} from "../../services/sessionReadings";

// ==========================================
// TRATAMENTO DE ERROS
// ==========================================

function errorMessage(error) {
  if (error?.response?.status === 403) {
    return "Sem permissão para consultar esta sessão.";
  }

  if (error?.response?.status === 401) {
    return "Sua sessão expirou. Faça login novamente.";
  }

  return "Não foi possível consultar os dados. Tente novamente.";
}

// ==========================================
// FORMATAÇÃO VISUAL
// ==========================================

function formatarTexto(value) {
  if (!value) return "Não informado";

  const texto = String(value)
    .replace(/_/g, " ")
    .toLocaleLowerCase("pt-BR");

  if (texto === "laboratorio") {
    return "Laboratório";
  }

  return texto.charAt(0).toUpperCase() +
    texto.slice(1);
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function SessionReadingsPanel({
  trips = [],
}) {
  const [tripId, setTripId] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [page, setPage] = useState({
    data: null,
    error: "",
    loading: false,
  });

  const [request, setRequest] = useState({});
  const [refresh, setRefresh] = useState(0);

  const validTrip = trips.some(
    (trip) => String(trip.id) === tripId
  );

  const sessionList = useIncrementalList(
    validTrip ? tripId : "",
    tripSessionList
  );

  const sessions = sessionList.records;
  const sessionLoading = sessionList.loading;
  const sessionError = sessionList.error;

  const selected =
    validTrip &&
    sessions.find(
      (session) => session.id === sessionId
    );

  const selectedId = selected?.id || "";

  const sessaoAtiva =
    String(selected?.estado ?? "")
      .trim()
      .toUpperCase() === "ATIVA";

  // ========================================
  // CONSULTA DAS LEITURAS
  // ========================================

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    async function load() {
      setPage({
        data: null,
        error: "",
        loading: true,
      });

      return loadSessionPage(
        selectedId,
        request
      );
    }

    load()
      .then((data) => {
        if (!cancelled) {
          setPage({
            data,
            error: "",
            loading: false,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPage({
            data: null,
            error: errorMessage(error),
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, request, refresh]);

  // ========================================
  // ATUALIZAÇÃO MANUAL
  // ========================================

  function atualizarLeituras() {
    setRequest({});
    setRefresh((n) => n + 1);
  }

  // ========================================
  // ORGANIZAÇÃO DOS DADOS DO GRÁFICO
  // ========================================

  const data = selected ? page.data : null;

  const groups = new Map();

  normalizarLeituras(
    data?.leituras ?? []
  ).forEach((reading) => {
    const item = groups.get(reading.timestamp) ?? {
      timestamp: reading.timestamp,
      temperature: null,
      humidity: null,
    };

    if (reading.tipo === "TEMPERATURA") {
      item.temperature = reading.valor;
    }

    if (reading.tipo === "UMIDADE") {
      item.humidity = reading.valor;
    }

    groups.set(reading.timestamp, item);
  });

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <Card className="session-readings">

      {/* CABEÇALHO DAS LEITURAS */}

      <div className="session-readings__header">

        <div className="session-readings__header-content">

          <h2 className="session-readings__header-title">
            Leituras por sessão
          </h2>

          <p className="session-readings__header-description">
            Selecione uma viagem e uma sessão.
            A consulta inicial mostra a última página
            da revisão disponível.
          </p>

        </div>

        {/* BOTÃO DE ATUALIZAÇÃO */}

        <button
          type="button"
          className="button button--secondary session-readings__refresh"
          disabled={
            !selected ||
            sessionLoading ||
            page.loading
          }
          onClick={atualizarLeituras}
        >
          <RefreshCw
            size={16}
            className={
              page.loading
                ? "dashboard__refresh--spinning"
                : ""
            }
          />

          {page.loading
            ? "Atualizando..."
            : "Atualizar leituras"}
        </button>

      </div>

      {/* FILTROS */}

      <div className="monitoramento-filtros">

        {/* SELEÇÃO DA VIAGEM */}

        <label>
          Viagem das leituras

          <select
            value={validTrip ? tripId : ""}
            onChange={(event) => {
              setTripId(event.target.value);
              setSessionId("");

              setPage({
                data: null,
                error: "",
                loading: false,
              });

              setRequest({});
            }}
          >
            <option value="">
              Selecione uma viagem
            </option>

            {trips.map((trip) => (
              <option
                key={trip.id}
                value={trip.id}
              >
                {trip.code || trip.id}
                {" · "}
                {trip.origin}
                {" → "}
                {trip.destination}
              </option>
            ))}
          </select>
        </label>

        {/* SELEÇÃO DA SESSÃO */}

        <label>
          Sessão das leituras

          <select
            value={selected ? sessionId : ""}
            disabled={
              !validTrip || sessionLoading
            }
            onChange={(event) => {
              setSessionId(event.target.value);

              setPage({
                data: null,
                error: "",
                loading: false,
              });

              setRequest({});
            }}
          >
            <option value="">
              Selecione uma sessão
            </option>

            {sessions.map((session) => (
              <option
                key={session.id}
                value={session.id}
              >
                {session.lote_codigo || session.id}
                {" · "}
                {session.estado}
              </option>
            ))}
          </select>
        </label>

      </div>

      {/* PAGINAÇÃO DAS SESSÕES */}

      {validTrip && (
        <ListProgress
          list={sessionList}
          label="sessões das leituras"
        />
      )}

      {sessionLoading && (
        <p role="status">
          Consultando sessões…
        </p>
      )}

      {validTrip &&
        !sessionLoading &&
        !sessionError &&
        sessions.length === 0 && (
          <p>
            Nenhuma sessão disponível nesta viagem.
          </p>
        )}

      {/* NENHUMA SESSÃO SELECIONADA */}

      {!selected && (
        <p>
          Selecione uma sessão para consultar as
          leituras. Conexão com a API não comprova
          recebimento de dados IoT.
        </p>
      )}

      {/* SESSÃO SELECIONADA */}

      {selected && (
        <>

          {/* IDENTIFICAÇÃO DA SESSÃO */}

          <section className="session-readings__details">

            <span className="session-readings__eyebrow">
              Identificação da sessão
            </span>

            <div className="session-readings__heading">

              <h3 className="session-readings__title">
                {selected.lote_hipotetico
                  ? "Lote hipotético"
                  : "Lote monitorado"}
              </h3>

              <span
                className={
                  "session-readings__badge " +
                  (sessaoAtiva
                    ? "session-readings__badge--active"
                    : "session-readings__badge--neutral")
                }
              >
                {sessaoAtiva ? (
                  <CircleCheck size={16} />
                ) : (
                  <Circle size={16} />
                )}

                Sessão {formatarTexto(selected.estado)}
              </span>

            </div>

            {/* INFORMAÇÕES INDIVIDUAIS */}

            <div className="session-readings__metadata">

              {/* CÓDIGO DO LOTE */}

              <div className="session-readings__metadata-item">

                <span className="session-readings__metadata-label">
                  Código do lote
                </span>

                <div className="session-readings__metadata-value">
                  <Hash size={18} />

                  <span>
                    {selected.lote_codigo ||
                      "Não informado"}
                  </span>
                </div>

              </div>

              {/* AMBIENTE DE AQUISIÇÃO */}

              <div className="session-readings__metadata-item">

                <span className="session-readings__metadata-label">
                  Ambiente de aquisição
                </span>

                <div className="session-readings__metadata-value">
                  <FlaskConical size={18} />

                  <span>
                    {formatarTexto(
                      selected.ambiente_aquisicao
                    )}
                  </span>
                </div>

              </div>

              {/* TIPO DE LOTE */}

              <div className="session-readings__metadata-item">

                <span className="session-readings__metadata-label">
                  Tipo de lote
                </span>

                <div className="session-readings__metadata-value">
                  <Package size={18} />

                  <span>
                    {selected.lote_hipotetico === true
                      ? "Hipotético"
                      : selected.lote_hipotetico === false
                        ? "Não hipotético"
                        : "Não informado"}
                  </span>
                </div>

              </div>

            </div>

            {/* AVISO INFORMATIVO */}

            <div className="session-readings__notice">

              <Info size={20} />

              <p>
                {sessaoAtiva
                  ? "Uma sessão ativa não comprova a aquisição contínua de dados dos sensores."
                  : "O estado da sessão, por si só, não comprova a aquisição de dados dos sensores."}
              </p>

            </div>

          </section>

          {/* GRÁFICO DA SESSÃO */}

          <ClimateChart
            title="Temperatura e umidade da sessão"
            description="Leituras registradas nesta página; não representa medição de etileno."
            readings={[...groups.values()]}
            loading={page.loading}
            error={page.error}
            onRetry={() =>
              setRefresh((n) => n + 1)
            }
          />

          {/* PAGINAÇÃO DAS LEITURAS */}

          {data && (
            <nav aria-label="Paginação das leituras">

              <p role="status">
                Registros{" "}
                {data.total ? data.offset + 1 : 0}
                –
                {data.offset + data.leituras.length}
                {" de "}
                {data.total}
                {" · Revisão "}
                {data.revisao}
              </p>

              <button
                type="button"
                className="button button--secondary"
                disabled={
                  page.loading || data.offset === 0
                }
                onClick={() =>
                  setRequest({
                    offset: Math.max(
                      0,
                      data.offset - READING_PAGE_SIZE
                    ),
                    revision: data.revisao,
                  })
                }
              >
                Leituras anteriores
              </button>

              <button
                type="button"
                className="button button--secondary"
                disabled={
                  page.loading ||
                  data.offset + data.limit >= data.total
                }
                onClick={() =>
                  setRequest({
                    offset:
                      data.offset + READING_PAGE_SIZE,
                    revision: data.revisao,
                  })
                }
              >
                Leituras seguintes
              </button>

            </nav>
          )}

        </>
      )}

    </Card>
  );
}
