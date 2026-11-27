import { useState } from "react";

import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Radio,
  Database,
  BrainCircuit,
  Activity,
  Info,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

import LogoIntro from "../../components/LogoIntro/LogoIntro";

import {
  fazerLogin,
  buscarUsuario,
} from "../../services/authService";

import "./LoginVisual.css";


export default function Login({ onContinue }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // ==========================================
  // AUTENTICAÇÃO
  // ==========================================

  async function handleSubmit(event) {

    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    sessionStorage.removeItem("chicosense_token");

    try {

      const loginData = await fazerLogin(
        email.trim(),
        password
      );

      const token = loginData?.access_token;

      if (
        typeof token !== "string" ||
        !token.trim()
      ) {
        throw new Error(
          "Token de acesso ausente na resposta."
        );
      }

      const usuario = await buscarUsuario(token);

      if (
        !usuario ||
        typeof usuario !== "object" ||
        Array.isArray(usuario)
      ) {
        throw new Error(
          "Resposta de usuário inválida."
        );
      }

      sessionStorage.setItem(
        "chicosense_token",
        token
      );

      await onContinue({
        ...usuario,
        name: usuario.name || usuario.nome || "",
        email: usuario.email || email.trim(),
      });

    } catch (err) {

      sessionStorage.removeItem("chicosense_token");

      const status = err?.response?.status;

      if (status === 401) {

        setError(
          "E-mail ou senha incorretos, ou sessão não autorizada."
        );

      } else if (status === 403) {

        setError(
          "Seu usuário não tem permissão para acessar."
        );

      } else if (status === 422) {

        setError(
          "Verifique os dados informados."
        );

      } else if (status === 404) {

        setError(
          "O serviço de autenticação não foi encontrado."
        );

      } else {

        setError(
          err?.message ||
          "Não foi possível concluir o login. Tente novamente."
        );

      }

    } finally {

      setPassword("");
      setShowPassword(false);
      setLoading(false);

    }
  }


  // ==========================================
  // INTERFACE
  // ==========================================

  return (

    <main className="chico-login">

      {/* =====================================
          PAINEL DE APRESENTAÇÃO
      ===================================== */}

      <section className="chico-login__presentation">

        {/* ELEMENTOS DECORATIVOS */}

        <div
          className="chico-login__grid"
          aria-hidden="true"
        />

        <div
          className="chico-login__glow"
          aria-hidden="true"
        />

        <div
          className="chico-login__orbit chico-login__orbit--one"
          aria-hidden="true"
        />

        <div
          className="chico-login__orbit chico-login__orbit--two"
          aria-hidden="true"
        />


        {/* LOGOTIPO ANIMADO */}

        <header className="chico-login__brand">

          <LogoIntro />

        </header>


        {/* APRESENTAÇÃO DO SISTEMA */}

        <div className="chico-login__message">

          <div className="chico-login__tag">

            <span className="chico-login__tag-dot" />

            INTELIGÊNCIA NO TRANSPORTE

          </div>

          <h1>
            Do campo ao destino,
            <br />
            cada detalhe{" "}
            <span>importa.</span>
          </h1>

          <p>
            Tecnologia que conecta dados, monitoramento
            e decisões para preservar a qualidade das
            frutas durante o transporte.
          </p>


          {/* RECURSOS DA PLATAFORMA */}

          <div className="chico-login__features">

            <div className="chico-login__feature">
              <Radio size={19} />
              <span>IoT</span>
            </div>

            <div className="chico-login__feature">
              <Database size={19} />
              <span>Dados</span>
            </div>

            <div className="chico-login__feature">
              <BrainCircuit size={19} />
              <span>IA</span>
            </div>

            <div className="chico-login__feature">
              <Activity size={19} />
              <span>Decisão</span>
            </div>

          </div>


          {/* GRÁFICO DECORATIVO */}

          <div
            className="chico-login__graphic"
            aria-hidden="true"
          >

            <svg
              viewBox="0 0 600 120"
              preserveAspectRatio="none"
            >

              <defs>

                <linearGradient
                  id="login-chart-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="0%"
                    stopColor="#C5F51B"
                    stopOpacity="0.18"
                  />

                  <stop
                    offset="100%"
                    stopColor="#C5F51B"
                    stopOpacity="0"
                  />

                </linearGradient>

              </defs>

              <g className="chico-login__chart-grid">

                <path d="M0 30 H600" />
                <path d="M0 60 H600" />
                <path d="M0 90 H600" />

              </g>

              <path
                d="
                  M0 95
                  C40 95 50 55 90 65
                  S150 90 190 45
                  S260 65 300 30
                  S370 65 410 25
                  S470 55 510 20
                  S570 35 600 10
                  V120 H0 Z
                "
                fill="url(#login-chart-fill)"
              />

              <path
                className="chico-login__chart-line"
                d="
                  M0 95
                  C40 95 50 55 90 65
                  S150 90 190 45
                  S260 65 300 30
                  S370 65 410 25
                  S470 55 510 20
                  S570 35 600 10
                "
                pathLength="1"
              />

              <circle
                cx="410"
                cy="25"
                r="5"
                fill="#C5F51B"
              />

              <circle
                cx="410"
                cy="25"
                r="11"
                fill="none"
                stroke="#C5F51B"
                opacity=".35"
              />

            </svg>

          </div>

        </div>


        {/* RODAPÉ DO PAINEL */}

        <footer className="chico-login__footnote">

          <Info size={17} />

          <p>
            Monitoramento complementar. O ChicoSense
            não controla a refrigeração do veículo.
          </p>

        </footer>

      </section>


      {/* =====================================
          ÁREA DE AUTENTICAÇÃO
      ===================================== */}

      <section
        className="chico-login__form-area"
        aria-labelledby="login-title"
      >

        <div className="chico-login__form-wrapper">

          <form
            className="chico-login__form"
            onSubmit={handleSubmit}
          >

            {/* CABEÇALHO */}

            <div className="chico-login__form-header">

              <div className="chico-login__security-icon">

                <ShieldCheck
                  size={27}
                  strokeWidth={1.8}
                />

              </div>

              <span className="chico-login__eyebrow">
                BEM-VINDO DE VOLTA
              </span>

              <h2 id="login-title">
                Acesse sua conta
              </h2>

              <p>
                Entre com suas credenciais para
                continuar no ChicoSense.
              </p>

            </div>


            {/* E-MAIL */}

            <div className="chico-login__field">

              <label htmlFor="login-email">
                E-mail
              </label>

              <div className="chico-login__input-wrapper">

                <Mail
                  className="chico-login__input-icon"
                  size={19}
                  aria-hidden="true"
                />

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="nome@empresa.com.br"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  disabled={loading}
                  required
                />

              </div>

            </div>


            {/* SENHA */}

            <div className="chico-login__field">

              <label htmlFor="login-password">
                Senha
              </label>

              <div className="chico-login__input-wrapper">

                <LockKeyhole
                  className="chico-login__input-icon"
                  size={19}
                  aria-hidden="true"
                />

                <input
                  id="login-password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="chico-login__password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >

                  {showPassword
                    ? <EyeOff size={19} />
                    : <Eye size={19} />
                  }

                </button>

              </div>

            </div>


            {/* MENSAGEM DE ERRO */}

            {error && (

              <div
                className="chico-login__error"
                role="alert"
              >

                <AlertCircle size={20} />

                <p>{error}</p>

              </div>

            )}


            {/* BOTÃO ENTRAR */}

            <button
              type="submit"
              className="chico-login__submit"
              disabled={loading}
            >

              {loading ? (

                <>
                  <LoaderCircle
                    size={20}
                    className="chico-login__spinner"
                  />

                  Autenticando...
                </>

              ) : (

                <>
                  Entrar na plataforma
                  <ArrowRight size={20} />
                </>

              )}

            </button>


            {/* INFORMAÇÃO DE SEGURANÇA */}

            <div className="chico-login__secure">

              <ShieldCheck size={16} />

              <span>
                Acesso restrito a usuários autorizados
              </span>

            </div>

          </form>


          {/* COPYRIGHT */}

          <p className="chico-login__copyright">

            © {new Date().getFullYear()} ChicoSense.
            Todos os direitos reservados.

          </p>

        </div>

      </section>

    </main>

  );
}