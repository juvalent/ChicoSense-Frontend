
import { useEffect, useRef, useState } from "react";

import {
  RefreshCw,
  Clock,
  Info,
  Save,
  AlertCircle,
  CircleCheck,
} from "lucide-react";

import Card from "../UI/Card";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Button from "../UI/Button";

import {
  canOperateTrip,
  logisticsError,
  readTrip,
  saveTrip,
  tripPayload,
} from "../../services/logisticsService";

import "./Logistics.css";

// ==========================================
// TRANSIÇÕES PERMITIDAS
// ==========================================

const transitions = {
  PLANEJADA: ["EM_ANDAMENTO", "CANCELADA"],
  EM_ANDAMENTO: ["CONCLUIDA"],
  CONCLUIDA: [],
  CANCELADA: [],
};

const statusLabels = {
  PLANEJADA: "Planejada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

// ==========================================
// CONTROLE DE PERMISSÕES
// ==========================================

export default function TripOperations({
  user,
  trip,
  busy = false,
  onSaved,
  onBusy = () => {},
}) {
  return canOperateTrip(user, trip) ? (
    <TripForm
      key={trip.id}
      id={trip.id}
      user={user}
      busy={busy}
      onSaved={onSaved}
      onBusy={onBusy}
    />
  ) : null;
}

// ==========================================
// FORMULÁRIO DA VIAGEM
// ==========================================

function TripForm({
  id,
  user,
  busy,
  onSaved,
  onBusy,
}) {
  const [view, setView] = useState({
    data: null,
    loading: true,
    error: "",
  });

  const [values, setValues] = useState({
    status: "",
    inicio_real: "",
    chegada_em: "",
    observacoes: "",
  });

  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");

  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  // ========================================
  // CONSULTAR ESTADO DA VIAGEM
  // ========================================

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setView({
        data: null,
        loading: true,
        error: "",
      });

      try {
        const data = await readTrip(
          id,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setView({
            data,
            loading: false,
            error: "",
          });

          setValues({
            status: data.status,
            inicio_real: "",
            chegada_em: "",
            observacoes: data.observacoes ?? "",
          });
        }

      } catch (error) {
        if (!controller.signal.aborted) {
          setView({
            data: null,
            loading: false,
            error: logisticsError(error),
          });
        }
      }
    }

    load();

    return () => controller.abort();

  }, [id, refresh]);

  const change = (field, value) =>
    setValues((old) => ({
      ...old,
      [field]: value,
    }));

  // ========================================
  // SALVAR ALTERAÇÕES
  // ========================================

  async function submit(event) {
    event.preventDefault();

    if (
      pending.current ||
      busy ||
      !view.data ||
      !canOperateTrip(user, view.data)
    ) {
      return;
    }

    let payload;

    try {
      payload = tripPayload(view.data, values);

    } catch (error) {
      setView((old) => ({
        ...old,
        error: error.message,
      }));

      return;
    }

    pending.current = true;

    setSaving(true);
    onBusy(true);
    setNotice("");

    let saved;

    try {
      saved = await saveTrip(id, payload);

    } catch (error) {
      if (mounted.current) {
        setView((old) => ({
          ...old,
          error: logisticsError(error, true),
        }));
      }

    } finally {
      pending.current = false;

      if (mounted.current) {
        setSaving(false);
        onBusy(false);
      }
    }

    if (saved && mounted.current) {
      setView({
        data: saved,
        loading: false,
        error: "",
      });

      setValues({
        status: saved.status,
        inicio_real: "",
        chegada_em: "",
        observacoes: saved.observacoes ?? "",
      });

      setNotice("Viagem atualizada.");

      onSaved?.(saved);
    }
  }

  // ========================================
  // INTERFACE
  // ========================================

  return (
    <Card className="viagem-operation">

      {/* CABEÇALHO */}

      <div className="viagem-operation__header">

        <div className="viagem-operation__heading">

          <h2 className="viagem-operation__title">
            Operação da viagem
          </h2>

          <p className="viagem-operation__description">
            Gerencie o estado e as informações
            operacionais da viagem.
          </p>

        </div>

        <Button
          variant="secondary"
          className="viagem-operation__refresh"
          disabled={
            busy || saving || view.loading
          }
          onClick={() => {
            setNotice("");
            setRefresh((n) => n + 1);
          }}
        >
          <RefreshCw
            size={16}
            className={
              view.loading
                ? "dashboard__refresh--spinning"
                : ""
            }
          />

          {view.loading
            ? "Atualizando..."
            : "Atualizar estado da viagem"}

        </Button>

      </div>

      {/* MENSAGENS DO SISTEMA */}

      {view.loading && (
        <div
          className="viagem-operation__notice"
          role="status"
        >
          <Info size={18} />

          <span>
            Consultando estado da viagem…
          </span>
        </div>
      )}

      {notice && (
        <div
          className="viagem-operation__notice viagem-operation__notice--success"
          role="status"
        >
          <CircleCheck size={18} />

          <span>{notice}</span>
        </div>
      )}

      {view.error && (
        <div
          className="viagem-operation__notice viagem-operation__notice--error"
          role="alert"
        >
          <AlertCircle size={18} />

          <span>{view.error}</span>
        </div>
      )}

      {/* FORMULÁRIO */}

      {view.data &&
        canOperateTrip(user, view.data) && (

          <form
            onSubmit={submit}
            aria-label="Atualizar viagem"
            className="logistics-form viagem-operation__form"
          >

            {/* ESTADO DA VIAGEM */}

            <Select
              label="Estado da viagem"
              value={values.status}
              disabled={saving}
              onChange={(event) =>
                change("status", event.target.value)
              }
              options={[
                view.data.status,
                ...(transitions[view.data.status] || []),
              ].map((value) => ({
                value,
                label: statusLabels[value] || value,
              }))}
            />

            {/* INÍCIO REAL */}

            {values.status !== view.data.status &&
              ["EM_ANDAMENTO", "CONCLUIDA"].includes(
                values.status
              ) &&
              !view.data.inicio_real && (

                <Input
                  label="Início real da viagem"
                  type="datetime-local"
                  required
                  disabled={saving}
                  value={values.inicio_real}
                  onChange={(event) =>
                    change(
                      "inicio_real",
                      event.target.value
                    )
                  }
                />

              )}

            {/* CHEGADA REAL */}

            {values.status !== view.data.status &&
              values.status === "CONCLUIDA" && (

                <Input
                  label="Chegada real da viagem"
                  type="datetime-local"
                  required
                  disabled={saving}
                  value={values.chegada_em}
                  onChange={(event) =>
                    change(
                      "chegada_em",
                      event.target.value
                    )
                  }
                />

              )}

            {/* INÍCIO REGISTRADO */}

            {view.data.inicio_real && (
              <div className="viagem-operation__notice">

                <Clock size={19} />

                <div>
                  <strong>
                    Início real registrado
                  </strong>

                  <p>
                    {new Date(
                      view.data.inicio_real
                    ).toLocaleString("pt-BR")}
                  </p>
                </div>

              </div>
            )}

            {/* OBSERVAÇÕES */}

            <label className="form-field">

              Observações da viagem

              <textarea
                className="input"
                rows={4}
                value={values.observacoes}
                disabled={saving}
                onChange={(event) =>
                  change(
                    "observacoes",
                    event.target.value
                  )
                }
              />

            </label>

            {/* AVISO INFORMATIVO */}

            <div className="viagem-operation__notice">

              <Info size={19} />

              <div>
                <strong>Informações importantes</strong>

                <p>
                  Datas e horas usam o horário local
                  do navegador. Alterar a viagem não
                  muda automaticamente cargas,
                  caixas ou sessões.
                </p>
              </div>

            </div>

            {/* SALVAR VIAGEM */}

            <div className="viagem-operation__actions">

              <Button
                type="submit"
                loading={saving}
                disabled={busy && !saving}
              >
                <Save size={17} />

                Salvar viagem
              </Button>

            </div>

          </form>

        )}

    </Card>
  );
}
