import logo from "../../assets/chicosense-branco-250x80.png";

import "./LogoIntro.css";

export default function LogoIntro() {
  return (
    <div
      className="logo-intro"
      style={{ "--logo-url": `url(${logo})` }}
    >
      <img
        className="logo-intro__img"
        src={logo}
        alt="ChicoSense"
        width={250}
        height={80}
      />

      <span
        className="logo-intro__shine"
        aria-hidden="true"
      />
    </div>
  );
}