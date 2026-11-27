import api from "./api";

const IA_BASE_URL = "/api/v1/ia";

// Consulta a disponibilidade do modelo de IA.
export async function obterStatusIA() {
  const response = await api.get(
    `${IA_BASE_URL}/status`
  );

  return response.data;
}

// Consulta os resultados históricos da IA.
export async function obterHistoricoIA() {
  const response = await api.get(
    `${IA_BASE_URL}/historico`
  );

  return response.data;
}

// Envia medições para análise pelo Isolation Forest.
export async function analisarMedicoesIA(medicoes) {
  const response = await api.post(
    `${IA_BASE_URL}/analisar`,
    {
      medicoes,
    }
  );

  return response.data;
}

// Consulta e analisa as medições reais do ThingSpeak.
export async function obterThingSpeakIA() {
  const response = await api.get(
    `${IA_BASE_URL}/thingspeak`
  );

  return response.data;
}