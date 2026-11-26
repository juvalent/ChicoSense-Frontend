import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import api from "../src/services/api";
import { availableSensors, partnerPage, dashboardSummary, sensorQuery } from "../src/services/backendIntegrationService";
import { readingQuery, readAcquisitionQuality } from "../src/services/acquisitionService";
import QualityIntervals from "../src/components/Monitoring/QualityIntervals";
import SensorProvisioning from "../src/components/Monitoring/SensorProvisioning";
import BusinessPartners from "../src/pages/Administracao/BusinessPartners";
import Dashboard from "../src/pages/Dashboard/Dashboard";
import { reply, user } from "./helpers";

const frame = { inicio: "2026-11-24T10:00:00Z", fim: "2026-11-24T11:00:00Z", revisao: 0, intervalo_maximo_s: "60" };
const key = JSON.stringify({ cargoId: "cargo", tripId: "trip", ambiente: "LABORATORIO", inicio: frame.inicio });
const sensor = { id: "sensor", identificador: "Sensor T", tipo: "TEMPERATURA", unidade: "C", contexto: "AMBIENTE" };
const catalog = { carga_id: "cargo", viagem_id: "trip", ambiente: "LABORATORIO", sensores: [sensor] };
const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("contratos autorizados da integração", () => {
  it("catálogo usa carga, ambiente e início e não endpoint global", async () => {
    const calls = []; api.defaults.adapter = async (c) => { calls.push(c); return reply(c, catalog); };
    expect(await availableSensors(key, { limit: 21, offset: 0 })).toEqual([sensor]);
    expect(calls[0].url).toBe("/api/v1/cargas/cargo/sensores-disponiveis"); expect(calls[0].params).toMatchObject({ ambiente: "LABORATORIO", inicio: frame.inicio });
  });
  it.each([{ viagem_id: "foreign" }, { carga_id: "foreign" }, { ambiente: "TRANSPORTE_REFRIGERADO" }])("rejeita catálogo de outro contexto %j", async (change) => {
    api.defaults.adapter = async (c) => reply(c, { ...catalog, ...change }); await expect(availableSensors(key, {limit:21,offset:0})).rejects.toThrow();
  });
  it("não consulta catálogo antes de início e ambiente explícitos ou com data inválida", () => {
    expect(sensorQuery("cargo", "trip", { inicio: "", ambiente_aquisicao: "LABORATORIO" })).toBeNull();
    expect(sensorQuery("cargo", "trip", { inicio: "data-invalida", ambiente_aquisicao: "LABORATORIO" })).toBeNull();
  });
  it("não aceita empresa sem aprovação para uma nova carga", async () => {
    api.defaults.adapter = async (c) => reply(c, [{ id: "producer", tipo: "PRODUTOR", autorizado_para_novas_cargas: false }]);
    await expect(partnerPage("carrier", "PRODUTOR", 0)).rejects.toThrow();
  });
  it("catálogo comercial usa a transportadora da viagem", async () => {
    const calls=[];api.defaults.adapter = async (c) => { calls.push(c); return reply(c,[{ id:"producer",tipo:"PRODUTOR",autorizado_para_novas_cargas:true }]); };
    await partnerPage("carrier", "PRODUTOR", 20);expect(calls[0].url).toBe("/api/v1/transportadoras/carrier/parceiros");expect(calls[0].params).toEqual({tipo:"PRODUTOR",limit:21,offset:20});
  });
  it("revisão zero é enviada explicitamente nas leituras", () => {
    expect(readingQuery({inicio:"",fim:"",tipo:"",revisao:"0"},{inicio:frame.inicio})).toEqual({revisao:0});
  });
  it("qualidade usa revisão zero e resposta compacta", async () => {
    const calls=[];api.defaults.adapter = async (c) => { calls.push(c);return reply(c,{sessao_id:"session",...frame,indicadores:[],natureza:"COBERTURA_TEMPORAL_DE_AQUISICAO_NAO_E_ESTIMATIVA_DE_ETILENO"}); };
    await readAcquisitionQuality("session",frame,"60");expect(calls[0].params).toMatchObject({revisao:0,incluir_intervalos:false});
  });
  it("resumo incompleto não vira contagem zero", async () => { api.defaults.adapter=async(c)=>reply(c,{viagens_total:0});await expect(dashboardSummary()).rejects.toThrow(); });
});

describe("interfaces conectadas ao backend", () => {
  it("dashboard apresenta agregados do servidor em vez da primeira página", async () => {
    api.defaults.adapter=async(c)=>reply(c,{consultado_em:frame.fim,viagens_total:30,viagens_em_transito:17,cargas_total:50,cargas_monitoradas:42,sessoes_ativas:9,alertas_abertos:3});
    render(<MemoryRouter><Dashboard user={user()} trips={[]} /></MemoryRouter>);expect(await screen.findByText("17")).toBeTruthy();expect(screen.getByText("42")).toBeTruthy();expect(screen.getByText("9")).toBeTruthy();
  });
  it("falha de resumo mantém indisponibilidade explícita", async () => {
    api.defaults.adapter=async(c)=>reply(c,{},503);render(<MemoryRouter><Dashboard user={user()} /></MemoryRouter>);expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.getAllByText("Dados indisponíveis")).toHaveLength(4);
  });
  it("pagina intervalos com revisão e janela fixadas", async () => {
    const calls=[];api.defaults.adapter=async(c)=>{calls.push(c);return reply(c,{sessao_id:"session",...frame,total:21,intervalos:[{sensor_id:"sensor",tipo:"TEMPERATURA",inicio:frame.inicio,fim:frame.fim,duracao_s:"3600",motivo:"SEM_LEITURAS"}]});};
    render(<QualityIntervals sessionId="session" result={frame} />);await screen.findByText(/21 intervalos/);fireEvent.click(screen.getByText("Próximos intervalos"));await waitFor(()=>expect(calls.at(-1).params.offset).toBe(20));expect(calls.at(-1).params).toMatchObject({revisao:0,inicio:frame.inicio,fim:frame.fim,intervalo_maximo_s:"60"});
  });
  it("intervalos de outra revisão não são exibidos", async () => {
    api.defaults.adapter=async(c)=>reply(c,{sessao_id:"session",...frame,revisao:1,total:0,intervalos:[]});render(<QualityIntervals sessionId="session" result={frame} />);expect(await screen.findByRole("alert")).toBeTruthy();expect(screen.queryByText(/0 intervalos/)).toBeNull();
  });
  it("ADMIN aprova parceiro com justificativa sem criar vínculo de usuário", async () => {
    const calls=[];
    api.defaults.adapter=async(c)=>{calls.push(c);if(c.method==="put")return reply(c,{id:"approval",transportadora_id:"carrier",empresa_id:"producer",ativo:true});return reply(c,c.url.endsWith("/empresas")?[{id:"producer",nome:"Produtor teste",tipo:"PRODUTOR",ativo:true}]:[]);};
    function Harness(){const[busy,setBusy]=useState(false);return <BusinessPartners company={{id:"carrier",nome:"Transportadora teste"}} busy={busy} onBusy={setBusy}/>;}
    render(<Harness/>);fireEvent.click(screen.getByText("Gerenciar parceiros comerciais"));await screen.findByRole("option",{name:"Produtor teste"});fill("Empresa parceira","producer");fill("Permissão para novas cargas","true");fill("Justificativa da aprovação ou revogação","Aprovação administrativa");fireEvent.submit(screen.getByRole("form",{name:"aprovação comercial"}));
    await waitFor(()=>expect(calls.filter(c=>c.method==="put")).toHaveLength(1));expect(JSON.parse(calls.find(c=>c.method==="put").data)).toEqual({ativo:true,justificativa:"Aprovação administrativa"});expect(calls.some(c=>c.url.includes("/usuarios"))).toBe(false);
  });
  it("cadastro de sensor não envia chave IoT nem produz leitura", async () => {
    const calls=[];api.defaults.adapter=async(c)=>{calls.push(c);return reply(c,[sensor],201);};
    function Harness(){const[busy,setBusy]=useState(false);return <SensorProvisioning cargoId="cargo" busy={busy} onBusy={setBusy}/>;}
    render(<Harness/>);fireEvent.click(screen.getByText("Cadastrar sensores da carga"));fill("Identificador do novo dispositivo","ESP-TESTE");fill("Identificador do sensor de temperatura","T-TESTE");fill("Contexto físico declarado","AMBIENTE");fill("Unidade de temperatura","C");fireEvent.submit(screen.getByRole("form",{name:"cadastro de sensores"}));
    await waitFor(()=>expect(calls).toHaveLength(1));expect(calls[0].url).toBe("/api/v1/cargas/cargo/sensores");expect(JSON.parse(calls[0].data)).toEqual({identificador_dispositivo:"ESP-TESTE",sensores:[{identificador:"T-TESTE",tipo:"TEMPERATURA",contexto:"AMBIENTE",unidade:"C"}]});
  });
});
