# ChicoSense Frontend

Frontend da aplicação ChicoSense, desenvolvido em React para o Projeto Integrador da Faculdade SENAC.

O ChicoSense é uma plataforma web voltada ao monitoramento climático e logístico da fruticultura do Vale do São Francisco, integrando dados de sensores, informações de cargas, viagens, condições climáticas e informações de mercado.

> Status: Em desenvolvimento

## Sobre o projeto

O ChicoSense tem como objetivo desenvolver uma plataforma capaz de auxiliar produtores, equipes de logística e clientes/mercado no acompanhamento das condições de transporte e monitoramento de cargas.

A solução integra dados de sensores IoT, informações climáticas, logística e mercado, permitindo visualizar os dados por meio de dashboards e indicadores.

O projeto faz parte do Projeto Integrador e será desenvolvido de forma integrada com um backend em Python responsável pela API REST e pelo acesso aos dados.

O fluxo principal da aplicação será:

Frontend React → API REST → Banco de Dados → Dashboard

## Perfis de usuário

A aplicação possui três perspectivas principais de utilização:

- Produtor
- Logística
- Cliente 

Os três perfis utilizam a mesma aplicação e estrutura de páginas, porém podem possuir diferentes indicadores, informações e níveis de acesso de acordo com seu perfil.

O sistema também prevê a utilização de controle de acesso baseado em perfis (RBAC).

## Funcionalidades previstas

Entre as principais funcionalidades do frontend estão:

- Seleção de perfil
- Dashboard personalizado de acordo com o perfil
- Visualização de viagens
- Visualização e acompanhamento de cargas
- Monitoramento de sensores
- Visualização de temperatura e umidade
- Histórico de dados climáticos
- Visualização de alertas
- Informações de mercado
- Informações relacionadas à logística
- Visualização de gráficos e indicadores
- Área de análise do ChicoSense IA
- Configurações da aplicação
- Interface responsiva e compatível com PWA
- Integração com a API REST do backend

## Arquitetura do frontend

```text
src/
│
├── assets/
│
├── components/
│   ├── Layout/
│   │   ├── Header.jsx
│   │   └── Sidebar.jsx
│   │
│   ├── Dashboard/
│   │   ├── MetricCard.jsx
│   │   ├── ClimateChart.jsx
│   │   └── RiskCard.jsx
│   │
│   ├── Charts/
│   ├── Tables/
│   └── UI/
│
├── pages/
│   ├── SelecaoPerfil/
│   ├── Dashboard/
│   ├── Viagens/
│   ├── Cargas/
│   ├── Monitoramento/
│   ├── Alertas/
│   ├── ChicoSenseIA/
│   ├── Historico/
│   └── Configuracoes/
│
├── contexts/
│   └── PerfilContext.jsx
│
├── services/
│   ├── api.js
│   ├── sensorService.js
│   ├── viagemService.js
│   ├── cargaService.js
│   └── alertaService.js
│
├── routes/
│   └── AppRoutes.jsx
│
├── styles/
│   └── global.css
│
├── App.jsx
└── main.jsx
