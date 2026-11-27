function display(value) {
  return value === null || value === undefined || value === "" ? "Não informado" : String(value);
}

export default function CargoDeclaration({ declaration }) {
  if (!declaration) return null;
  return <dl className="settings-page__profile">
    <div><dt>Produto declarado</dt><dd>{display(declaration.produto_identificado)}</dd></div>
    <div><dt>Massa líquida (kg)</dt><dd>{display(declaration.massa_kg)}</dd></div>
    <div><dt>Maturação</dt><dd>{display(declaration.maturacao)}</dd></div>
    <div><dt>Lote</dt><dd>{display(declaration.lote_codigo)}</dd></div>
    <div><dt>Lote hipotético</dt><dd>{declaration.lote_hipotetico === true ? "Sim" : declaration.lote_hipotetico === false ? "Não" : "Não informado"}</dd></div>
    <div><dt>Rastreabilidade</dt><dd>{display(declaration.rastreabilidade)}</dd></div>
    <div><dt>Versão da declaração</dt><dd>{display(declaration.versao)}</dd></div>
  </dl>;
}
