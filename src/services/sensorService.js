
import api from "./api";

import {
  listarLeiturasSessao,
  normalizarLeituras,
} from "./monitoramentoService";

// ==========================================
// LEITURAS OPERACIONAIS POR SESSÃO
// ==========================================

export async function listarLeituras(
  sessaoId,
  { limit = 100, offset = 0 } = {}
) {
  if (!sessaoId) {
    return [];
  }

  const resposta = await listarLeiturasSessao(
    sessaoId,
    { limit, offset }
  );

  const leituras = normalizarLeituras(
    resposta.leituras
  );

  const registros = new Map();

  leituras.forEach((leitura) => {
    const timestamp = leitura.timestamp;

    if (!timestamp) return;

    if (!registros.has(timestamp)) {
      registros.set(timestamp, {
        timestamp,
        temperature: null,
        humidity: null,
      });
    }

    const registro = registros.get(timestamp);

    const tipo = String(leitura.tipo ?? "")
      .trim()
      .toUpperCase();

    if (
      tipo === "TEMPERATURA" ||
      tipo === "TEMPERATURE"
    ) {
      registro.temperature = leitura.valor;
    }

    if (
      tipo === "UMIDADE" ||
      tipo === "HUMIDITY"
    ) {
      registro.humidity = leitura.valor;
    }
  });

  return Array.from(registros.values()).sort(
    (a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
  );
}

// ==========================================
// INTEGRAÇÃO COM THINGSPEAK
// ==========================================

export async function obterStatusThingSpeak() {
  const { data } = await api.get(
    "/api/v1/integracoes/thingspeak/status"
  );

  return data;
}

export async function listarFeedsThingSpeak(
  results = 10
) {
  const { data } = await api.get(
    "/api/v1/integracoes/thingspeak/feeds",
    {
      params: { results },
    }
  );

  return data;
}

export async function obterUltimaLeituraThingSpeak() {
  const { data } = await api.get(
    "/api/v1/integracoes/thingspeak/ultima-leitura"
  );

  return data;
}

export async function sincronizarThingSpeak(
  results = 100
) {
  const { data } = await api.post(
    "/api/v1/integracoes/thingspeak/sincronizar",
    null,
    {
      params: { results },
    }
  );

  return data;
}

// ==========================================
// VALIDAÇÃO DOS VALORES DOS SENSORES
// ==========================================

function numeroValido(value) {
  if (
    value == null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numero = Number(
    String(value).replace(",", ".")
  );

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ==========================================
// LEITURAS GLOBAIS DO DASHBOARD
// ==========================================

export async function listarLeiturasDashboard(
  results = 100
) {
  // Consulta os dados reais do ThingSpeak
  // através do backend ChicoSense.

  const resposta = await listarFeedsThingSpeak(
    results
  );

  const payload = resposta?.data ?? resposta;

  // Estrutura real retornada pelo backend.

  const feeds = payload?.leituras_normalizadas;

  if (!Array.isArray(feeds)) {
    throw new Error(
      "Formato de resposta do ThingSpeak não reconhecido."
    );
  }

  const registros = new Map();

  // ========================================
  // PROCESSAMENTO DAS LEITURAS
  // ========================================

  for (const feed of feeds) {

    if (!feed) continue;

    // Ignora medições invalidadas pelo backend.

    if (feed.ignorada === true) {
      continue;
    }

    // Utiliza somente os sensores do protótipo.

    const contexto = String(feed.contexto ?? "")
      .trim()
      .toUpperCase();

    if (contexto !== "PROTOTIPO") {
      continue;
    }

    // Valida o horário da medição.

    const timestamp = feed.created_at;

    if (!timestamp) {
      continue;
    }

    const data = new Date(timestamp);

    if (!Number.isFinite(data.getTime())) {
      continue;
    }

    const chave = data.toISOString();

    // Identifica o tipo da leitura.

    const tipo = String(feed.tipo ?? "")
      .trim()
      .toUpperCase();

    const ehTemperatura = [
      "TEMPERATURA",
      "TEMPERATURE",
    ].includes(tipo);

    const ehUmidade = [
      "UMIDADE",
      "HUMIDITY",
    ].includes(tipo);

    if (!ehTemperatura && !ehUmidade) {
      continue;
    }

    // Converte o valor recebido para número.

    const valor = numeroValido(feed.valor);

    if (valor === null) {
      continue;
    }

    // Agrupa as medições do mesmo horário.

    if (!registros.has(chave)) {
      registros.set(chave, {
        timestamp: chave,
        temperature: null,
        humidity: null,
      });
    }

    const registro = registros.get(chave);

    // Registra a temperatura.

    if (ehTemperatura) {
      registro.temperature = valor;
    }

    // Registra a umidade.

    if (ehUmidade) {
      registro.humidity = valor;
    }
  }

  // ========================================
  // ORGANIZAÇÃO DOS DADOS PARA O GRÁFICO
  // ========================================

  const leituras = Array.from(registros.values())
    .filter(
      (item) =>
        item.temperature !== null ||
        item.humidity !== null
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    );

  return leituras;
}