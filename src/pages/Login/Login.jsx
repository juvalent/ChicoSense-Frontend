import { useState } from "react";
import { Activity } from "lucide-react";
import Button from "../../components/UI/Button";
import Input from "../../components/UI/Input";
import { fazerLogin, buscarUsuario } from "../../services/authService";

export default function Login({ onContinue }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Envia e-mail e senha para o backend
      const loginData = await fazerLogin(email.trim(), password);

      // Recupera o token de autenticação
      const token = loginData.access_token;

      if (!token) {
        throw new Error("O backend não retornou um token de acesso.");
      }

      // Consulta os dados do usuário autenticado
      const usuario = await buscarUsuario(token);

      // Guarda o token para as próximas requisições
      sessionStorage.setItem("chicosense_token", token);

      // Continua o fluxo que já existe no App.jsx
      onContinue({
        email: email.trim(),
        usuario,
      });

      setPassword("");
    } catch (err) {
      console.error("Erro ao fazer login:", err);

      if (err.response?.status === 401) {
        setError("E-mail ou senha incorretos.");
      } else if (err.response?.status === 422) {
        setError("Verifique os dados informados.");
      } else {
        setError(
          "Não foi possível entrar. Verifique a conexão com o servidor."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-page__presentation">
        <div className="access-brand">
          <span className="access-brand__icon">
            <Activity size={24} aria-hidden="true" />
          </span>

          <div>
            <strong>ChicoSense</strong>
            <span className="access-brand__caption">
              COLD CHAIN INTELLIGENCE
            </span>
          </div>
        </div>

        <div className="login-page__message">
          <h1>Inteligência para cada etapa da cadeia fria.</h1>

          <p>
            Transforme leituras de sensores em visibilidade,
            alertas e decisões mais seguras para suas cargas.
          </p>

          <div className="login-page__steps">
            <span>IoT</span>
            <span>Dados</span>
            <span>IA</span>
            <span>Decisão</span>
          </div>
        </div>

        <p className="login-page__footnote">
          Monitoramento complementar. O ChicoSense não controla
          a refrigeração do veículo.
        </p>
      </section>

      <section
        className="login-page__form-area"
        aria-labelledby="login-title"
      >
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="access-eyebrow">
            Bem-vindo de volta
          </span>

          <h2 id="login-title">Acesse sua conta</h2>

          <p className="login-form__description">
            Acompanhe suas cargas e condições de transporte.
          </p>

          <Input
            label="E-mail"
            name="email"
            type="email"
            placeholder="nome@empresa.com.br"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <Input
            label="Senha"
            name="password"
            type="password"
            placeholder="Digite sua senha"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p
              role="alert"
              style={{
                color: "#dc2626",
                fontSize: "14px",
                marginTop: "10px",
              }}
            >
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading
              ? "Entrando..."
              : "Continuar para seleção de perfil"}
          </Button>
        </form>
      </section>
    </main>
  );
}