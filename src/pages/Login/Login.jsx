import { useState } from "react";
import { Activity } from "lucide-react";
import Button       from "../../components/UI/Button";
import Input        from "../../components/UI/Input";

export default function Login({ onContinue }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    onContinue({
      email: email.trim(),
    });

    setPassword("");
  }

  return (
    <main className        ="login-page">
      <section className   ="login-page__presentation">
        <div className     ="access-brand">
          <span className  ="access-brand__icon">
            <Activity size ={24} aria-hidden="true" />
          </span>

          <div>
            <strong>ChicoSense</strong>
            <span className ="access-brand__caption">
              COLD CHAIN INTELLIGENCE
            </span>
          </div>
        </div>

        <div className ="login-page__message">
          <h1>
            Inteligência para cada etapa da cadeia fria.
          </h1>

          <p>
            Transforme leituras de sensores em visibilidade,
            alertas e decisões mais seguras para suas cargas.
          </p>

          <div className ="login-page__steps">
            <span>IoT</span>
            <span>Dados</span>
            <span>IA</span>
            <span>Decisão</span>
          </div>
        </div>

        <p className ="login-page__footnote">
          Monitoramento complementar. O ChicoSense não controla
          a refrigeração do veículo.
        </p>
      </section>

      <section
        className      ="login-page__form-area"
        aria-labelledby="login-title"
      >
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="access-eyebrow">
            Bem-vindo de volta
          </span>

          <h2 id="login-title">Acesse sua conta</h2>

          <p className ="login-form__description">
            Acompanhe suas cargas e condições de transporte.
          </p>

          <div className ="login-form__notice" role="note">
            Interface em desenvolvimento: as credenciais ainda
            não são verificadas. Não utilize sua senha real.
          </div>

          <Input
            label        ="E-mail"
            name         ="email"
            type         ="email"
            placeholder  ="nome@empresa.com.br"
            autoComplete ="email"
            value        ={email}
            onChange     ={(event) => setEmail(event.target.value)}
            required
          />

          <Input
            label        ="Senha"
            name         ="password"
            type         ="password"
            placeholder  ="Digite uma senha de teste"
            autoComplete ="off"
            value        ={password}
            onChange     ={(event) => setPassword(event.target.value)}
            required
          />

          <Button type="submit">
            Continuar para seleção de perfil
          </Button>
        </form>
      </section>
    </main>
  );
}