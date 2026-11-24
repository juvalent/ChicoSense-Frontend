// UI affordances only. Every request remains authorized by the backend.
export function capabilities(user) {
  const active = user?.ativo === true;
  const admin = active && user.perfil === "ADMIN";
  const carrier = active && Array.isArray(user.empresas) && user.empresas.some(
    (company) => company.ativo === true && company.tipo === "TRANSPORTADORA"
  );
  const operate = admin || (carrier && ["GESTOR", "OPERADOR"].includes(user.perfil));
  return {
    administer: admin,
    manageFleet: admin || (carrier && user.perfil === "GESTOR"),
    operate,
    configureEnvironment: admin || (carrier && user.perfil === "GESTOR"),
    globalIntegration: admin,
  };
}
