import api from "./api";

export async function listarLeituras() {
  const response = await api.get(
    "/api/v1/integracoes/thingspeak/feeds",
    {
      params: { results: 10 },
    }
  );

  const leituras = response.data.leituras_normalizadas ?? [];
  const registros = new Map();

  leituras.forEach((leitura) => {
    if (leitura.ignorada) return;

    const id = leitura.entry_id;

    if (!registros.has(id)) {
      registros.set(id, {
        timestamp: leitura.created_at,
        temperature: null,
        humidity: null,
      });
    }

    const registro = registros.get(id);
    const valor = Number(leitura.valor);

    if (!Number.isFinite(valor)) return;

    if (leitura.tipo === "TEMPERATURA") {
      registro.temperature = valor;
    }

    if (leitura.tipo === "UMIDADE") {
      registro.humidity = valor;
    }
  });

  return Array.from(registros.values());
}