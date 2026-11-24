import useIncrementalList from "./useIncrementalList";
import { cargoList } from "../services/pagedLists";
export default function useViagemCargas(viagemId) {
  const list = useIncrementalList(viagemId, cargoList);
  return { ...list, loads: list.records };
}
