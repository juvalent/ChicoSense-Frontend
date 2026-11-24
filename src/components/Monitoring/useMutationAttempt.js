import { useEffect, useRef, useState } from "react";
import { lifecycleError, uncertainMutation } from "../../services/monitoringLifecycleService";

// Preserve a request in memory across an uncertain response. Never auto-repeat it.
export default function useMutationAttempt(attempt, setAttempt, onBusy, onSaved) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [frozen, setFrozen] = useState(Boolean(attempt?.uncertain));
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event, { build, send, values, busy }) {
    event.preventDefault();
    if (pending.current || busy) return;
    let request;
    try { request = attempt || { payload: build(), values: { ...values }, uncertain: false }; }
    catch (failure) { setError(failure.message); return; }
    pending.current = true; setSaving(true); setError(""); onBusy(true);
    setAttempt(request);
    let saved;
    try { saved = await send(request.payload); setAttempt(null); }
    catch (failure) {
      const uncertain = uncertainMutation(failure);
      setAttempt(uncertain ? { ...request, uncertain: true } : null);
      if (mounted.current) { setFrozen(uncertain); setError(lifecycleError(failure, true)); }
    } finally {
      pending.current = false;
      if (mounted.current) { setSaving(false); onBusy(false); }
    }
    if (saved && mounted.current) onSaved(saved);
  }
  return { saving, error, frozen, submit };
}
