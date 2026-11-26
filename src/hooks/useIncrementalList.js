import { useEffect, useState } from "react";
export const LIST_SIZE = 20;
// One bounded request per action. Never render or append a previous scope.
export default function useIncrementalList(key, loader) {
  const [request, setRequest] = useState({ key: null, offset: 0, version: 0 });
  const [view, setView] = useState({ key: null, records: [], loading: false, error: "", hasNext: false });
  const offset = request.key === key ? request.offset : 0;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    loader(key, { limit: LIST_SIZE + 1, offset, signal: controller.signal }).then((rows) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(rows) || rows.some((row) => !row?.id) || new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Página inválida.");
      setView((old) => {
        const previous = old.key === key && offset > 0 ? old.records : [];
        const page = rows.slice(0, LIST_SIZE);
        if (page.some((row) => previous.some((item) => item.id === row.id))) return { key, offset, version: request.version, records: previous, loading: false, hasNext: false, error: "A lista mudou durante a paginação. Atualize a consulta." };
        return { key, offset, version: request.version, records: [...previous, ...page], loading: false, error: "", hasNext: rows.length > LIST_SIZE };
      });
    }).catch((error) => {
      if (!controller.signal.aborted) setView((old) => ({ key, offset, version: request.version, records: old.key === key && offset > 0 ? old.records : [], loading: false, hasNext: false, error: error?.response?.status === 401 ? "Sua sessão expirou. Faça login novamente." : error?.response?.status === 403 ? "Sem permissão para consultar estes registros." : "Não foi possível carregar a lista. Atualize para tentar novamente." }));
    });
    return () => controller.abort();
  }, [key, loader, offset, request.version]);
  const settled = view.key === key && view.offset === offset && view.version === request.version;
  const current = settled ? view : { records: view.key === key && offset > 0 ? view.records : [], loading: Boolean(key), error: "", hasNext: false };
  return { ...current, more: () => { if (!current.loading && current.hasNext) setRequest({ key, offset: offset + LIST_SIZE, version: request.version }); }, retry: () => setRequest({ key, offset: 0, version: request.version + 1 }) };
}
