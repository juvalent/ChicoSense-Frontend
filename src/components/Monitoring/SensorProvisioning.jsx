import { useState } from "react";
import Button from "../UI/Button";
import { OperationalForm } from "./OperationalWidgets";
import api from "../../services/api";

export default function SensorProvisioning({ cargoId, busy, onBusy }) {
  const [open, setOpen] = useState(false), [attempt, setAttempt] = useState(null), [notice, setNotice] = useState("");
  const fields = [{ name: "device", label: "Identificador do novo dispositivo" }, { name: "temperature", label: "Identificador do sensor de temperatura" },
    { name: "context", label: "Contexto físico declarado", options: ["AMBIENTE", "PRODUTO", "CAIXA", "PROTOTIPO"] },
    { name: "unit", label: "Unidade de temperatura", options: ["C", "°C", "F", "°F", "K"] },
    { name: "humidity", label: "Identificador de umidade (opcional, unidade %)" }];
  return <>
    <p>ADMIN: cadastre somente dispositivos identificados e vinculados a esta carga. Não configura ThingSpeak, não cria leituras e não aciona hardware.</p>
    {notice && <p role="status">{notice}</p>}
    <Button disabled={busy} variant="secondary" onClick={() => setOpen(true)}>Cadastrar sensores da carga</Button>
    {open && <OperationalForm title="cadastro de sensores" fields={fields} attempt={attempt} setAttempt={setAttempt} busy={busy} onBusy={onBusy}
      build={(v) => {
        const required = (value) => { const text = String(value || "").trim(); if (!text || text.length > 120) throw new Error("Informe identificadores de até 120 caracteres."); return text; };
        if (!["AMBIENTE", "PRODUTO", "CAIXA", "PROTOTIPO"].includes(v.context) || !["C", "°C", "F", "°F", "K"].includes(v.unit)) throw new Error("Selecione contexto e unidade.");
        const sensores = [{ identificador: required(v.temperature), tipo: "TEMPERATURA", contexto: v.context, unidade: v.unit }];
        if (v.humidity.trim()) sensores.push({ identificador: required(v.humidity), tipo: "UMIDADE", contexto: v.context, unidade: "%" });
        return { identificador_dispositivo: required(v.device), sensores };
      }}
      send={async (payload) => { const { data } = await api.post(`/api/v1/cargas/${encodeURIComponent(cargoId)}/sensores`, payload); if (!Array.isArray(data) || !data.length) throw new Error("Cadastro não confirmado."); return data; }}
      onSaved={() => { setOpen(false); setNotice("Sensores cadastrados. Abra ou atualize o catálogo no início da sessão. Configure a origem de ingestão separadamente."); }} onCancel={() => setOpen(false)} />}
  </>;
}
